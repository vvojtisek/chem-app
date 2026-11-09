"""Whitelist parser for calculus input.

The parser builds SymPy objects directly from tokens. It never calls
``sympify``, ``parse_expr`` or ``eval``: those evaluate Python source and
must not see user input (ADR 0015).
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from dataclasses import dataclass

import sympy as sp

MAX_INPUT_LENGTH = 200
MAX_TOKENS = 120
MAX_DEPTH = 20
MAX_INTEGER_DIGITS = 12
MAX_POWER_DIGITS = 1000
MAX_SYMBOLIC_EXPONENT = 1000

# Variables are single Latin letters. `e` is Euler's number, so it is excluded.
VARIABLE_LETTERS = frozenset("abcdfghkmnpqrstuvwxyz")

_SYMBOLS: dict[str, sp.Symbol] = {
    letter: sp.Symbol(letter, real=True) for letter in VARIABLE_LETTERS
}

_CONSTANTS: dict[str, sp.Expr] = {
    "pi": sp.pi,
    "e": sp.E,
    "oo": sp.oo,
    "inf": sp.oo,
    "infinity": sp.oo,
}


def _log(*args: sp.Expr) -> sp.Expr:
    if len(args) == 1:
        return sp.log(args[0])
    return sp.log(args[0], args[1])


_FUNCTIONS: dict[str, tuple[Callable[..., sp.Expr], tuple[int, ...]]] = {
    "sin": (sp.sin, (1,)),
    "cos": (sp.cos, (1,)),
    "tan": (sp.tan, (1,)),
    "tg": (sp.tan, (1,)),
    "cot": (sp.cot, (1,)),
    "cotg": (sp.cot, (1,)),
    "sec": (sp.sec, (1,)),
    "csc": (sp.csc, (1,)),
    "asin": (sp.asin, (1,)),
    "arcsin": (sp.asin, (1,)),
    "acos": (sp.acos, (1,)),
    "arccos": (sp.acos, (1,)),
    "atan": (sp.atan, (1,)),
    "arctan": (sp.atan, (1,)),
    "arctg": (sp.atan, (1,)),
    "sinh": (sp.sinh, (1,)),
    "cosh": (sp.cosh, (1,)),
    "tanh": (sp.tanh, (1,)),
    "exp": (sp.exp, (1,)),
    "ln": (sp.log, (1,)),
    "log": (_log, (1, 2)),
    "sqrt": (sp.sqrt, (1,)),
    "abs": (sp.Abs, (1,)),
}

_TOKEN_RE = re.compile(
    r"\s*(?:(?P<number>\d+(?:\.\d+)?)|(?P<name>[A-Za-z]+)|(?P<op>\*\*|[-+*/^(),=]))"
)


class MathParseError(ValueError):
    """Input rejected by the parser. `code` is stable; `message` is Czech."""

    def __init__(self, code: str, message: str, position: int | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.position = position


@dataclass(frozen=True, slots=True)
class Token:
    kind: str
    text: str
    position: int


def symbol(letter: str) -> sp.Symbol:
    """Return the canonical real symbol for a variable letter."""
    if letter not in _SYMBOLS:
        raise MathParseError("invalid_variable", f"Neplatná proměnná: {letter}.")
    return _SYMBOLS[letter]


def tokenize(source: str) -> list[Token]:
    if len(source) > MAX_INPUT_LENGTH:
        raise MathParseError("input_too_long", f"Výraz je delší než {MAX_INPUT_LENGTH} znaků.")
    tokens: list[Token] = []
    position = 0
    while position < len(source):
        if source[position:].strip() == "":
            break
        match = _TOKEN_RE.match(source, position)
        if match is None:
            offset = len(source[position:]) - len(source[position:].lstrip())
            bad = source[position + offset]
            raise MathParseError(
                "unexpected_character", f"Nepodporovaný znak „{bad}“.", position + offset
            )
        start = match.start(match.lastgroup or 0)
        kind = match.lastgroup or "op"
        text = match.group(kind)
        if kind == "op" and text == "**":
            text = "^"
        tokens.append(Token(kind, text, start))
        position = match.end()
        if len(tokens) > MAX_TOKENS:
            raise MathParseError("input_too_long", "Výraz je příliš dlouhý.")
    return tokens


class _Parser:
    def __init__(self, tokens: list[Token]) -> None:
        self.tokens = tokens
        self.index = 0
        self.depth = 0

    def peek(self) -> Token | None:
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def advance(self) -> Token:
        token = self.peek()
        if token is None:
            raise MathParseError("unexpected_end", "Výraz je neúplný.")
        self.index += 1
        return token

    def expect(self, text: str) -> None:
        token = self.peek()
        if token is None or token.text != text:
            position = token.position if token else None
            raise MathParseError("expected_token", f"Očekáváno „{text}“.", position)
        self.index += 1

    def enter(self) -> None:
        self.depth += 1
        if self.depth > MAX_DEPTH:
            raise MathParseError("too_deeply_nested", "Výraz je příliš vnořený.")

    def leave(self) -> None:
        self.depth -= 1

    # sum := product (("+" | "-") product)*
    def parse_sum(self) -> sp.Expr:
        result = self.parse_product()
        while (token := self.peek()) is not None and token.text in "+-" and token.kind == "op":
            self.advance()
            right = self.parse_product()
            result = result + right if token.text == "+" else result - right
        return result

    # product := unary (("*" | "/") unary | <implicit> power)*
    def parse_product(self) -> sp.Expr:
        result = self.parse_unary()
        while (token := self.peek()) is not None:
            if token.kind == "op" and token.text in "*/":
                self.advance()
                right = self.parse_unary()
                if token.text == "*":
                    result = result * right
                else:
                    if right == 0:
                        raise MathParseError("division_by_zero", "Dělení nulou.", token.position)
                    result = result / right
            elif token.kind in ("number", "name") or token.text == "(":
                result = result * self.parse_power()
            else:
                break
        return result

    def parse_unary(self) -> sp.Expr:
        token = self.peek()
        if token is not None and token.kind == "op" and token.text in "+-":
            self.advance()
            self.enter()
            operand = self.parse_unary()
            self.leave()
            return -operand if token.text == "-" else operand
        return self.parse_power()

    # power := primary ("^" unary)?   (right associative)
    def parse_power(self) -> sp.Expr:
        base = self.parse_primary()
        token = self.peek()
        if token is not None and token.text == "^":
            self.advance()
            self.enter()
            exponent = self.parse_unary()
            self.leave()
            return checked_power(base, exponent, token.position)
        return base

    def parse_primary(self) -> sp.Expr:
        token = self.advance()
        if token.kind == "number":
            return parse_number(token)
        if token.kind == "name":
            return self.parse_name(token)
        if token.text == "(":
            self.enter()
            inner = self.parse_sum()
            self.leave()
            self.expect(")")
            return inner
        raise MathParseError("unexpected_token", f"Neočekávané „{token.text}“.", token.position)

    def parse_name(self, token: Token) -> sp.Expr:
        name = token.text.lower() if token.text.lower() in _FUNCTIONS else token.text
        if name in _FUNCTIONS:
            return self.parse_call(name, token)
        if name in _CONSTANTS:
            return _CONSTANTS[name]
        if all(letter in VARIABLE_LETTERS for letter in name):
            # "xy" is read as x*y.
            product: sp.Expr = sp.Integer(1)
            for letter in name:
                product = product * _SYMBOLS[letter]
            return product
        raise MathParseError("unknown_name", f"Neznámý název „{token.text}“.", token.position)

    def parse_call(self, name: str, token: Token) -> sp.Expr:
        function, arities = _FUNCTIONS[name]
        self.enter()
        next_token = self.peek()
        if next_token is not None and next_token.text == "(":
            self.advance()
            args = [self.parse_sum()]
            while (separator := self.peek()) is not None and separator.text == ",":
                self.advance()
                args.append(self.parse_sum())
            self.expect(")")
        else:
            # "sin x^2" means sin(x^2).
            args = [self.parse_power()]
        self.leave()
        if len(args) not in arities:
            raise MathParseError(
                "wrong_argument_count",
                f"Funkce {name} nepřijímá {len(args)} argumenty.",
                token.position,
            )
        return function(*args)


def parse_number(token: Token) -> sp.Expr:
    integer_part = token.text.split(".", 1)[0]
    if len(integer_part) > MAX_INTEGER_DIGITS or len(token.text) > MAX_INTEGER_DIGITS + 8:
        raise MathParseError("number_too_large", "Číslo je příliš velké.", token.position)
    return sp.Rational(token.text) if "." in token.text else sp.Integer(token.text)


def checked_power(base: sp.Expr, exponent: sp.Expr, position: int | None = None) -> sp.Expr:
    """Build base**exponent, refusing results that would be huge to compute."""
    if exponent.is_Number and exponent.is_integer and abs(int(exponent)) > MAX_SYMBOLIC_EXPONENT:
        raise MathParseError("exponent_too_large", "Exponent je příliš velký.", position)
    if base.is_Number and exponent.is_Number and base != 0:
        magnitude = abs(float(base))
        if magnitude not in (0.0, 1.0) and math.isfinite(magnitude):
            digits = abs(float(exponent)) * abs(math.log10(magnitude))
            if digits > MAX_POWER_DIGITS:
                raise MathParseError("exponent_too_large", "Mocnina je příliš velká.", position)
    if base == 0 and exponent.is_Number and exponent.is_negative:
        raise MathParseError("division_by_zero", "Dělení nulou.", position)
    return sp.Pow(base, exponent)


def parse_expression(source: str) -> sp.Expr:
    """Parse one expression. Raises MathParseError on any invalid input."""
    tokens = tokenize(source)
    if not tokens:
        raise MathParseError("empty_input", "Zadejte výraz.")
    if any(token.text == "=" for token in tokens):
        raise MathParseError("unexpected_equals", "Výraz nesmí obsahovat „=“.")
    parser = _Parser(tokens)
    result = parser.parse_sum()
    if (token := parser.peek()) is not None:
        raise MathParseError("unexpected_token", f"Neočekávané „{token.text}“.", token.position)
    if result.has(sp.zoo, sp.nan):
        raise MathParseError("undefined_expression", "Výraz není definován.")
    return result


def parse_equation(source: str) -> tuple[sp.Expr, sp.Expr]:
    """Parse `left = right`."""
    if source.count("=") != 1:
        raise MathParseError("expected_equation", "Zadejte rovnici s jedním „=“.")
    left, right = source.split("=", 1)
    return parse_expression(left), parse_expression(right)


def parse_point(source: str) -> sp.Expr:
    """Parse a limit point or integration bound: a constant expression or ±oo."""
    value = parse_expression(source)
    if value.free_symbols:
        raise MathParseError("expected_constant", "Zadejte číslo, ne výraz s proměnnou.")
    return value


def parse_bound(source: str, allowed: frozenset[sp.Symbol]) -> sp.Expr:
    """Parse an integration bound that may depend on outer variables."""
    value = parse_expression(source)
    extra = value.free_symbols - allowed
    if extra:
        names = ", ".join(sorted(str(item) for item in extra))
        raise MathParseError("invalid_bound", f"Mez závisí na nepovolené proměnné: {names}.")
    return value
