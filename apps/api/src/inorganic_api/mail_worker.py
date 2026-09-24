"""Deliver queued account links: python -m inorganic_api.mail_worker."""

import logging
import time

from cryptography.fernet import InvalidToken

from inorganic_api.config import get_settings
from inorganic_api.database import create_session_factory
from inorganic_api.errors import AppError
from inorganic_api.repositories import mail_outbox
from inorganic_api.services import email

logger = logging.getLogger(__name__)


def run_once() -> bool:
    settings = get_settings()
    with create_session_factory()() as db:
        message = mail_outbox.claim_next(db)
    if message is None:
        return False
    try:
        token = email.decrypt_token(settings, message.encrypted_token)
    except (InvalidToken, ValueError):
        logger.error("Queued mail %s cannot be decrypted; dropping it", message.id)
        with create_session_factory()() as db:
            mail_outbox.delivered(db, message.id)
        return True
    try:
        email.send_account_link(settings, message.recipient, token, message.purpose)
    except AppError:
        logger.warning("Queued mail %s delivery failed; retry scheduled", message.id)
        with create_session_factory()() as db:
            mail_outbox.retry_later(db, message.id)
        return True
    with create_session_factory()() as db:
        mail_outbox.delivered(db, message.id)
    return True


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    email.require_delivery_config(get_settings())
    logger.info("Mail delivery worker started")
    while True:
        if not run_once():
            time.sleep(2)


if __name__ == "__main__":
    main()
