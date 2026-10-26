"""Extract learning text locally. Office files need only Python's standard library."""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

LIMIT = 100000

def extract_office(filename, extension):
    with zipfile.ZipFile(filename) as archive:
        if extension == '.docx':
            names = ['word/document.xml']
        else:
            names = sorted(
                (n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                key=lambda n: int(re.search(r'slide(\d+)', n).group(1)),
            )
        output = []
        total = 0
        for index, name in enumerate(names[:200], 1):
            info = archive.getinfo(name)
            if info.file_size > 10000000 or total + info.file_size > 50000000:
                raise ValueError('文档结构过大，请拆分文件后导入。')
            total += info.file_size
            raw = archive.read(name)
            if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
                raise ValueError('文档包含不支持的 XML 声明。')
            root = ET.fromstring(raw)
            paragraphs = []
            for paragraph in root.iter():
                if paragraph.tag.rsplit('}', 1)[-1] == 'p':
                    value = ''.join(node.text or '' for node in paragraph.iter() if node.tag.rsplit('}', 1)[-1] == 't')
                    if value.strip():
                        paragraphs.append(value)
            if extension == '.pptx':
                output.append(f'第 {index} 页\n' + '\n'.join(paragraphs))
            else:
                output.extend(paragraphs)
            if sum(map(len, output)) > LIMIT:
                return {'text': '\n\n'.join(output)[:LIMIT], 'truncated': True}
        text = '\n\n'.join(output)
        return {'text': text[:LIMIT], 'truncated': len(text) > LIMIT or len(names) > 200}

def extract_pdf(filename):
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ValueError('PDF 解析需要 pypdf。请为 Python 安装 pypdf，或先导入文本。')
    reader = PdfReader(filename)
    if reader.is_encrypted and not reader.decrypt(''):
        raise ValueError('PDF 已加密，请先解密后导入。')
    output = []
    count = len(reader.pages)
    truncated = count > 100
    for number, page in enumerate(reader.pages[:100], 1):
        text = page.extract_text() or ''
        if text.strip():
            output.append(f'第 {number} 页\n{text}')
        if sum(map(len, output)) > LIMIT:
            truncated = True
            break
    return {'text': '\n\n'.join(output)[:LIMIT], 'truncated': truncated, 'pages': count}

if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    try:
        result = extract_pdf(sys.argv[1]) if sys.argv[2] == '.pdf' else extract_office(sys.argv[1], sys.argv[2])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        message = str(error) if isinstance(error, ValueError) else '文档无法解析，请检查格式、文件完整性或是否加密。'
        print(json.dumps({'error': message}, ensure_ascii=False))
        sys.exit(1)
