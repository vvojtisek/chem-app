import { Fragment } from "react";
import { chemicalTextParts } from "@/lib/chemical-text";
import { Formula } from "./formula";

/** Safe semantic notation in prose; authored text is never interpreted as HTML. */
export function ChemicalText({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {chemicalTextParts(text).map((part) =>
        part.kind === "text" ? (
          <Fragment key={part.offset}>{part.text}</Fragment>
        ) : (
          <span className="whitespace-nowrap" key={part.offset}>
            <Formula formula={part.formula} charge={part.charge} />
            {part.oxidation ? (
              <span role="img" aria-label={`oxidační číslo ${part.oxidation}`}>
                <sup>{part.oxidation}</sup>
              </span>
            ) : null}
          </span>
        ),
      )}
    </>
  );
}
