"""Signed / public delivery URLs for Cloudinary assets (fixes 401 on private PDFs)."""
import re
from typing import Any, Dict, Optional, Tuple

import cloudinary
import cloudinary.utils


def _ensure_cloudinary_configured() -> None:
    """Api-secret is required for private_download_url; configure if main.py did not yet."""
    if cloudinary.config().api_secret:
        return
    from app.config.config import settings
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def _public_id_from_url(url: str) -> Tuple[Optional[str], str]:
    """Extract public_id and resource_type from a Cloudinary delivery URL."""
    if not url or 'res.cloudinary.com' not in url:
        return None, 'image'
    match = re.search(r'/(image|raw|video)/upload/(?:v\d+/)?(.+?)(?:\?.*)?$', url)
    if not match:
        return None, 'image'
    resource_type = match.group(1)
    public_id = match.group(2)
    for ext in ('.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.wps'):
        if public_id.lower().endswith(ext):
            public_id = public_id[: -len(ext)]
            break
    return public_id, resource_type


def get_viewable_url(file_meta: Dict[str, Any]) -> str:
    """
    Return a URL the patient can open in the browser.
    Uses signed delivery when cloudinaryPublicId is available.
    """
    stored = (file_meta.get('url') or '').strip()
    public_id = file_meta.get('cloudinaryPublicId')
    file_type = (file_meta.get('fileType') or '').lower()

    resource_type = 'image'
    if public_id:
        if file_type == 'pdf':
            resource_type = 'image'
        elif file_type in ('doc', 'docx'):
            resource_type = 'raw'
    else:
        extracted_id, extracted_type = _public_id_from_url(stored)
        if extracted_id:
            public_id = extracted_id
            resource_type = extracted_type

    if not public_id:
        return stored

    _ensure_cloudinary_configured()
    try:
        opts: Dict[str, Any] = {
            'resource_type': resource_type,
            'sign_url': True,
            'secure': True,
            'type': 'upload',
        }
        if file_type == 'pdf' or stored.lower().endswith('.pdf'):
            opts['format'] = 'pdf'
            opts['resource_type'] = 'image'
        url, _ = cloudinary.utils.cloudinary_url(public_id, **opts)
        return url or stored
    except Exception:
        return stored


def _formats_for_download(file_meta: Dict[str, Any]) -> list[str]:
    """Cloudinary format strings for private_download_url."""
    file_type = (file_meta.get('fileType') or '').lower()
    file_name = (file_meta.get('fileName') or '').lower()
    if file_type == 'pdf' or file_name.endswith('.pdf'):
        return ['pdf']
    if file_type in ('jpg', 'jpeg') or file_name.endswith(('.jpg', '.jpeg')):
        return ['jpg']
    if file_type == 'png' or file_name.endswith('.png'):
        return ['png']
    if file_type == 'doc' or file_name.endswith('.doc'):
        return ['doc']
    if file_type in ('docx', 'vnd.openxmlformats-officedocument.wordprocessingml.document') or file_name.endswith('.docx'):
        return ['docx']
    if file_type == 'wps' or file_name.endswith('.wps'):
        return ['wps']
    return []


def _admin_download_urls(file_meta: Dict[str, Any]) -> list[str]:
    """
    Signed Cloudinary API download URLs (work when res.cloudinary.com returns 401).
    Requires api_secret configured on the server.
    """
    _ensure_cloudinary_configured()
    public_id = file_meta.get('cloudinaryPublicId')
    if not public_id:
        stored = (file_meta.get('url') or '').strip()
        public_id, _ = _public_id_from_url(stored)
    if not public_id:
        return []

    file_type = (file_meta.get('fileType') or '').lower()
    file_name = (file_meta.get('fileName') or '').lower()
    is_raw = file_type in ('doc', 'docx', 'wps') or file_name.endswith(('.doc', '.docx', '.wps'))
    resource_types = ('raw', 'image') if is_raw else ('image', 'raw')

    urls: list[str] = []
    for resource_type in resource_types:
        for fmt in _formats_for_download(file_meta) or ['']:
            try:
                url = cloudinary.utils.private_download_url(
                    public_id,
                    fmt,
                    resource_type=resource_type,
                    type='upload',
                )
                if url and url not in urls:
                    urls.append(url)
            except Exception:
                continue
    return urls


def _candidate_urls(file_meta: Dict[str, Any]) -> list[str]:
    """URLs to try when fetching file bytes server-side."""
    stored = (file_meta.get('url') or '').strip()
    public_id = file_meta.get('cloudinaryPublicId')
    file_type = (file_meta.get('fileType') or '').lower()

    urls: list[str] = []
    urls.extend(_admin_download_urls(file_meta))
    if public_id:
        for resource_type, fmt in (
            ('image', 'pdf'),
            ('raw', None),
            ('image', None),
        ):
            if file_type == 'pdf' and resource_type == 'raw' and fmt is None:
                continue
            opts: Dict[str, Any] = {
                'resource_type': resource_type,
                'sign_url': True,
                'secure': True,
                'type': 'upload',
            }
            if fmt:
                opts['format'] = fmt
            try:
                url, _ = cloudinary.utils.cloudinary_url(public_id, **opts)
                if url and url not in urls:
                    urls.append(url)
            except Exception:
                pass

    view = file_meta.get('viewUrl')
    if view and view not in urls:
        urls.append(view)
    if stored and stored not in urls:
        urls.append(stored)
    return urls


async def fetch_file_bytes(file_meta: Dict[str, Any]) -> tuple[bytes, str, str]:
    """Download file from Cloudinary. Returns (content, content_type, filename)."""
    import httpx

    filename = file_meta.get('fileName') or 'report.pdf'
    file_type = (file_meta.get('fileType') or '').lower()
    default_ct_map = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'wps': 'application/vnd.ms-works',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
    }
    default_ct = default_ct_map.get(file_type, 'application/octet-stream')
    lower_name = filename.lower()
    if default_ct == 'application/octet-stream':
        for ext, ct in (
            ('.pdf', 'application/pdf'),
            ('.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
            ('.doc', 'application/msword'),
            ('.wps', 'application/vnd.ms-works'),
            ('.jpg', 'image/jpeg'),
            ('.jpeg', 'image/jpeg'),
            ('.png', 'image/png'),
        ):
            if lower_name.endswith(ext):
                default_ct = ct
                break

    last_error = None
    for url in _candidate_urls(file_meta):
        try:
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    last_error = f'HTTP {response.status_code}'
                    continue
                content = response.content
                if len(content) < 50:
                    last_error = 'empty response'
                    continue
                if file_type == 'pdf' and content[:4] != b'%PDF':
                    last_error = 'not a valid PDF'
                    continue
                ct = response.headers.get('content-type') or default_ct
                if ';' in ct:
                    ct = ct.split(';')[0].strip()
                return content, ct, filename
        except Exception as exc:
            last_error = str(exc)
            continue

    raise ValueError(last_error or 'Could not download file from storage')


def enrich_attachment_files(files: list) -> list:
    if not isinstance(files, list):
        return files
    out = []
    for item in files:
        if not isinstance(item, dict):
            out.append(item)
            continue
        enriched = dict(item)
        enriched['viewUrl'] = get_viewable_url(enriched)
        out.append(enriched)
    return out
