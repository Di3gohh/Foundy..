import asyncio
import smtplib
from email.message import EmailMessage

from app.core.config import settings


def has_smtp_settings() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


async def send_verification_email(to_email: str, token: str) -> bool:
    link = f"{settings.app_public_url.rstrip('/')}/verificar-email?token={token}"
    subject = "Confirme seu e-mail na Foundy"
    body = (
        "Ola!\n\n"
        "Para publicar ou reivindicar itens na Foundy, confirme seu e-mail acessando o link abaixo:\n\n"
        f"{link}\n\n"
        "Se voce nao pediu isso, ignore esta mensagem."
    )
    return await _send_email(to_email=to_email, subject=subject, body=body)


async def send_support_email(subject: str, body: str) -> bool:
    return await _send_email(to_email=settings.support_email, subject=subject, body=body)


async def send_notification_email(to_email: str, subject: str, body: str) -> bool:
    return await _send_email(to_email=to_email, subject=subject, body=body)


async def _send_email(to_email: str, subject: str, body: str) -> bool:
    if not has_smtp_settings():
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(body)

    await asyncio.to_thread(_send_message, message)
    return True


def _send_message(message: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
