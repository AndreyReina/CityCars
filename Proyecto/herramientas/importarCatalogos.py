"""Importa fuentes descargadas de municipios y tablas de vehículos a catálogos JSON versionados.
Capa: Herramientas de desarrollo. Requiere pdfplumber y fuentes locales; no descarga datos.
Consulte documentacion/CATALOGOS.md.
"""
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
import pdfplumber

root = Path(sys.argv[1])
output = Path('frontend/src/datos')
output.mkdir(parents=True, exist_ok=True)
normalize = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s.casefold()) if not unicodedata.combining(c))
clean = lambda s: re.sub(r'\s+', ' ', s or '').strip()
brands = {}
sources = []
for filename in ['vehicles-2026.pdf', 'table2.pdf', 'table3.pdf', 'table4.pdf', 'table9.pdf']:
    path = root / filename
    count = 0
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if len(row) < 6:
                        continue
                    kind, brand, model = clean(row[2]), clean(row[3]), clean(row[4])
                    if kind not in ['AUTOMOVIL', 'CAMIONETAS Y CAMPEROS', 'DOBLECABINA'] or not brand or not model:
                        continue
                    # Fiscal fallback rows are not actual model names.
                    if model.startswith('LINEAS Y CILINDRAJES') or model == 'SIN LINEA':
                        continue
                    model = model.replace(' (LINEA BASE ESTANDAR)', '').strip()
                    brand = brand.upper()
                    brand = {'ACCURA': 'ACURA', 'INTERNATIONA L': 'INTERNATIONAL', 'MESSERSCHMIT T': 'MESSERSCHMITT', 'SUPERFORMAN CE': 'SUPERFORMANCE', 'SAICWULING': 'SAIC WULING', 'STUDEBACKER': 'STUDEBAKER'}.get(brand, brand)
                    if len(brand) > 60 or len(model) > 80 or '\ufffd' in brand + model:
                        raise ValueError(f'Invalid extracted name: {brand!r} {model!r}')
                    brands.setdefault(brand, {})[normalize(model)] = model
                    count += 1
            page.close()
    sources.append({'file': filename, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'rows': count})
    print(filename, count, flush=True)
brands['XPENG'] = {normalize(m): m for m in ['G6', 'G9', 'L03']}
vehicles = {b: sorted(models.values(), key=normalize) for b, models in sorted(brands.items(), key=lambda x: normalize(x[0]))}
assert len(vehicles) > 60 and sum(map(len, vehicles.values())) > 4000
(output / 'catalogo-vehiculos.json').write_text(json.dumps(vehicles, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
municipalities = json.loads((root / 'municipalities.json').read_text(encoding='utf-8-sig'))
towns = [{'code': r['cod_mpio'], 'name': r['nom_mpio'].title(), 'department': r['dpto'].title(), 'type': r['tipo_municipio']} for r in municipalities]
assert len(towns) > 1100 and len({r['code'] for r in towns}) == len(towns)
towns.sort(key=lambda r: (normalize(r['name']), normalize(r['department'])))
(output / 'catalogo-municipios.json').write_text(json.dumps(towns, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
sources.append({'file': 'municipalities.json', 'sha256': hashlib.sha256((root / 'municipalities.json').read_bytes()).hexdigest(), 'rows': len(towns)})
(output / 'fuentes-catalogos.json').write_text(json.dumps({'retrieved': '2026-10-28', 'vehicleYear': 2026, 'sources': sources, 'brands': len(vehicles), 'models': sum(map(len, vehicles.values())), 'locations': len(towns), 'supplements': [{'url': 'https://www.xpeng.com/co/', 'brand': 'XPENG', 'models': ['G6', 'G9', 'L03']}]}, indent=2) + '\n', encoding='utf8')
print('Complete:', len(vehicles), 'brands;', sum(map(len, vehicles.values())), 'models;', len(towns), 'locations', flush=True)
