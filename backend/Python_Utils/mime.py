def get_mime_type_from_extension(ext):
    ext = ext.lower()
    mime_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg',  # Доп. расширение OGG
        '.webm': 'audio/webm',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
    }
    return mime_types.get(ext, 'application/octet-stream')