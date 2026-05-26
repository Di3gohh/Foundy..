import asyncio
import smtplib
from email.message import EmailMessage

from app.core.config import settings


async def send_verification_email(to_email: str, token: str) -> None:
    link = f"{settings.app_public_url.rstrip('/')}/verificar-email?token={token}"
    subject = "Confirme seu e-mail na Foundy"
    body = (
        "Olá!\n\n"
        "Para publicar ou reivindicar itens na Foundy, confirme seu e-mail acessando o link abaixo:\n\n"
        f"{link}\n\n"
        "Se você não pediu isso, ignore esta mensagem."
    )

    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(body)

    await asyncio.to_thread(_send_message, message)


def _send_message(message: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
