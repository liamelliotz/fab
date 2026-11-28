"""Converte as cores fixas dos CSS do FAB em tokens com versão clara (igual à atual) e escura."""
import re, sys, math, pathlib

RAIZ = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'src')  # frontend/src
EXCLUIR = {'app/shared/components/qr-code/qr-code.css'}

def hex6(h):
    h = h.lower().lstrip('#')
    if len(h) in (3, 4): h = ''.join(c*2 for c in h)
    return h

def srgb_lin(c):
    c /= 255
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def lin_srgb(c):
    c = max(0.0, min(1.0, c))
    v = 12.92*c if c <= 0.0031308 else 1.055*c**(1/2.4)-0.055
    return round(max(0, min(1, v))*255)

def to_oklch(h):
    r,g,b = (srgb_lin(int(h[i:i+2],16)) for i in (0,2,4))
    l = 0.4122214708*r+0.5363325363*g+0.0514459929*b
    m = 0.2119034982*r+0.6806995451*g+0.1073969566*b
    s = 0.0883024619*r+0.2817188376*g+0.6299787005*b
    l,m,s = (x**(1/3) for x in (l,m,s))
    L = 0.2104542553*l+0.7936177850*m-0.0040720468*s
    a = 1.9779984951*l-2.4285922050*m+0.4505937099*s
    bb = 0.0259040371*l+0.7827717662*m-0.8086757660*s
    return L, math.hypot(a,bb), math.atan2(bb,a)

def from_oklch(L,C,H):
    a, b = C*math.cos(H), C*math.sin(H)
    for _ in range(30):  # reduz o croma até caber no sRGB
        l_ = L+0.3963377774*a+0.2158037573*b
        m_ = L-0.1055613458*a-0.0638541728*b
        s_ = L-0.0894841775*a-1.2914855480*b
        l,m,s = l_**3, m_**3, s_**3
        r = 4.0767416621*l-3.3077115913*m+0.2309699292*s
        g = -1.2684380046*l+2.6097574011*m-0.3413193965*s
        bl = -0.0041960863*l-0.7034186147*m+1.7076147010*s
        if all(-0.001 <= x <= 1.001 for x in (r,g,bl)): break
        a *= 0.9; b *= 0.9
    return '#%02x%02x%02x' % (lin_srgb(r), lin_srgb(g), lin_srgb(bl))

MATIZ_FAB = math.radians(160)  # verde da marca: cinzas e brancos ganham um leve tom dele no escuro

def escuro(h, papel):
    L,C,H = to_oklch(h)
    if C < 0.02:  # quase sem cor (brancos e cinzas): matiz da marca, croma mínimo
        H, C = MATIZ_FAB, max(C, 0.012)
    if papel == 's':  # fundo / superfície
        if L >= 0.995: return from_oklch(0.235, 0.008, H)         # branco: cartões
        if L >= 0.62 and 0.02 <= C < 0.09: return from_oklch(0.28, min(0.06, C*1.3), H)  # pastéis (selos, avisos): mantêm a cor
        if L >= 0.62 and C < 0.09: return from_oklch(0.17 + (1-L)*0.7, C*0.55, H)  # claros e pastéis
        if L >= 0.62: return from_oklch(L*0.78, C*0.85, H)          # vivos claros (barras, selos): um pouco mais escuros
        return '#' + h                                              # escuros e saturados: botões, menu
    if papel == 't':  # texto, ícones
        if L < 0.62: return from_oklch(min(0.96, 1.04 - 0.42*L), min(C, 0.16), H)
        return '#' + h
    if papel == 'b':  # bordas, contornos e anéis
        if L >= 0.62 and C < 0.09: return from_oklch(0.30 + (1-L)*0.6, C*0.5, H)
        if L < 0.62: return from_oklch(min(0.85, 0.98 - 0.42*L), min(C, 0.16), H)
        return from_oklch(L*0.85, C, H)
    raise ValueError(papel)

TEXTO = {'color','fill','stroke','caret-color','text-decoration-color','-webkit-text-fill-color','accent-color','text-shadow','column-rule-color'}
def papel_de(prop):
    p = prop.strip().lower()
    if p.startswith('--'):
        if re.search(r'(bg|fundo|suave|light|surface|hover)', p): return 's'
        if re.search(r'border|borda|linha', p): return 'b'
        return 't'
    if p in TEXTO: return 't'
    if p.startswith('border') or p.startswith('outline') or p in ('box-shadow',): return 'b'
    if p.startswith('background'): return 's'
    return 's'

tokens = {}  # nome -> (claro, escuro)
DECL = re.compile(r'([-\w]+)(\s*:\s*)([^;{}]+)(;|(?=\}))')
COR = re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|(?<![-\w])(white|black)(?![-\w])')
NOMES = {'white': 'ffffff', 'black': '000000'}

def troca_decl(m):
    prop, sep, valor, fim = m.groups()
    if prop.startswith('--') and prop.startswith(('--t-','--s-','--b-')): return m.group(0)
    papel = papel_de(prop)
    def sub(c):
        h = NOMES[c.group(2)] if c.group(2) else hex6(c.group(0))
        alfa = ''
        if len(h) == 8: h, alfa = h[:6], h[6:]
        if alfa:  # cor com transparência: deixa como está
            return c.group(0)
        nome = f'--{papel}-{h}'
        tokens[nome] = ('#'+h, escuro(h, papel))
        return f'var({nome})'
    return prop + sep + COR.sub(sub, valor) + fim

def converter(caminho, texto):
    # Só mexe dentro de blocos de regras (não em seletores); comentários ficam como estão.
    saida, i = [], 0
    for c in re.finditer(r'/\*.*?\*/', texto, re.S):
        saida.append(DECL.sub(troca_decl, texto[i:c.start()])); saida.append(c.group(0)); i = c.end()
    saida.append(DECL.sub(troca_decl, texto[i:]))
    return ''.join(saida)

arquivos = sorted(p for p in (RAIZ/'app').rglob('*.css'))
alterados = 0
for p in arquivos:
    rel = str(p.relative_to(RAIZ))
    if rel in EXCLUIR: continue
    t = p.read_text(encoding='utf-8')
    n = converter(rel, t)
    if n != t:
        p.write_text(n, encoding='utf-8'); alterados += 1

# Estilos escritos dentro do .ts (styles: [`...`]) também viram tokens.
for p in sorted((RAIZ/'app').rglob('*.ts')):
    if p.name.endswith('.spec.ts'): continue
    t = p.read_text(encoding='utf-8')
    if 'styles:' not in t: continue
    n = re.sub(r'(styles:\s*\[?\s*`)(.*?)(`)', lambda m: m.group(1) + converter(str(p), m.group(2)) + m.group(3), t, flags=re.S)
    if n != t:
        p.write_text(n, encoding='utf-8'); alterados += 1

# styles.css: só as regras depois do :root (tokens de marca tratados à mão) e os chips/campos
estilo = RAIZ/'styles.css'
t = estilo.read_text(encoding='utf-8')
ini = t.index('/* 3. RESET VISUAL')
t = t[:ini] + converter('styles.css', t[ini:])
estilo.write_text(t, encoding='utf-8')

# Reconstrói a lista a partir de TODOS os tokens em uso (assim dá para rodar de novo sem perder nada).
USO = re.compile(r'var\(--([stb])-([0-9a-f]{6})\)')
for p in list((RAIZ/'app').rglob('*.css')) + list((RAIZ/'app').rglob('*.ts')) + [estilo]:
    for papel, h in USO.findall(p.read_text(encoding='utf-8')):
        tokens[f'--{papel}-{h}'] = ('#'+h, escuro(h, papel))

linhas_claro = '\n'.join(f'  {k}: {v[0]};' for k, v in sorted(tokens.items()))
linhas_escuro = '\n'.join(f'    {k}: {v[1]};' for k, v in sorted(tokens.items()))
(RAIZ/'styles'/'tema-cores.css').write_text(f"""/* =========================================================================================
   CORES DO FAB EM TOKENS (tema claro e escuro). ARQUIVO GERADO: não edite à mão.
   Cada cor fixa dos componentes virou um token com o papel no nome:
     --s-xxxxxx  fundo/superfície     --t-xxxxxx  texto e ícones     --b-xxxxxx  bordas e contornos
   O valor claro é a cor original (o tema claro não muda nada). O escuro é calculado no espaço
   OKLCH: fundos claros escurecem, textos escuros clareiam e cores fortes (botões, menu) ficam.
   Para regenerar depois de criar CSS novo com cores fixas: python3 tools/gerar-tema.py (dentro de frontend/)
   ========================================================================================= */
:root {{
{linhas_claro}
}}

/* Só na tela: impressão (termos, relatórios) sai sempre no tema claro. */
@media screen {{
  html.tema-escuro {{
{linhas_escuro}
  }}
}}
""", encoding='utf-8')
print(f'{alterados} arquivos convertidos, {len(tokens)} tokens')
