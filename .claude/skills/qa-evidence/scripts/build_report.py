"""Compile a QA manifest into a PDF report.

    python build_report.py path/to/qa-manifest.json

Scoreboard numbers are computed from the manifest, never taken from prose --
a scoreboard that disagrees with its own table destroys the reader's trust.
"""

import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, Image, KeepTogether,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

from qa_manifest import Manifest, to_para

INK, MUTED, LINE = colors.HexColor('#16181C'), colors.HexColor('#6A6F76'), colors.HexColor('#D9DBD7')
ACCENT, SOFT = colors.HexColor('#2E5E4E'), colors.HexColor('#EEF4F1')
OK, OKBG, OKDOT = colors.HexColor('#1B5E3F'), colors.HexColor('#E3F1E9'), colors.HexColor('#2E9E68')
FAIL, FAILDOT = colors.HexColor('#8C1D18'), colors.HexColor('#D14A42')
TOOLDOT, WARN = colors.HexColor('#B9BCC0'), colors.HexColor('#7A5300')

PER_ROW, SHOT_W = 4, 30 * mm


def st(name, **kw):
    base = dict(fontName='Helvetica', fontSize=9.5, leading=13.5,
                textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)


S = {
    'title': st('t', fontName='Times-Bold', fontSize=25, leading=29, spaceAfter=4),
    'kicker': st('k', fontName='Courier-Bold', fontSize=7.5, textColor=ACCENT, spaceAfter=7),
    'lede': st('l', fontSize=9.5, leading=14, textColor=MUTED, spaceAfter=13),
    'h2': st('h2', fontName='Times-Bold', fontSize=14.5, leading=18, spaceBefore=15, spaceAfter=5),
    'h3': st('h3', fontName='Helvetica-Bold', fontSize=10, leading=14, spaceBefore=8, spaceAfter=3),
    'body': st('b', spaceAfter=5),
    'small': st('s', fontSize=8.5, leading=12, textColor=MUTED),
    'cell': st('c', fontSize=7.6, leading=10.2),
    'cellb': st('cb', fontName='Helvetica-Bold', fontSize=7.8, leading=10.4),
    'th': st('th', fontName='Courier-Bold', fontSize=6.6, leading=9, textColor=MUTED),
    'cap': st('cap', fontSize=6.9, leading=9.2, textColor=INK),
    'sec': st('sec', fontName='Courier-Bold', fontSize=7.2, leading=10, textColor=ACCENT),
}

NOPAD = [('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
         ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]


def dots(seq):
    """One square per attempt: f=app defect, t=tooling problem, p=passed."""
    cmap = {'f': FAILDOT, 't': TOOLDOT, 'p': OKDOT}
    cells, widths, cmd, col = [], [], [], 0
    for i, ch in enumerate(seq):
        cells.append('')
        widths.append(3.0 * mm)
        cmd.append(('BACKGROUND', (col, 0), (col, 0), cmap.get(ch, TOOLDOT)))
        col += 1
        if i != len(seq) - 1:
            cells.append('')
            widths.append(1.1 * mm)
            col += 1
    t = Table([cells], colWidths=widths, rowHeights=[3.0 * mm])
    t.setStyle(TableStyle(cmd + NOPAD))
    return t


def boxed(rows, widths, extra=()):
    t = Table(rows, colWidths=widths)
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, LINE), ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), *extra,
    ]))
    return t


def build(manifest_path: str) -> None:
    m = Manifest(manifest_path)
    out = m.rel('report_out') or (m.base / 'laporan-qc.pdf')
    out.parent.mkdir(parents=True, exist_ok=True)
    shots = m.rel('shots_dst')
    sc = m.scoreboard()

    # Fail loudly instead of silently emitting a report with no evidence in it --
    # a 20 KB PDF that should be 2 MB is easy to miss and worthless to a reader.
    wanted = [s['img'] for c in m.cases for s in (c.get('steps') or [])]
    if wanted:
        if not shots or not shots.exists():
            sys.exit(f"shots_dst tidak ditemukan: {shots}\n"
                     f"{len(wanted)} langkah butuh gambar. Perbaiki path di manifest "
                     f"(relatif terhadap {m.path.name}).")
        absent = [n for n in wanted
                  if not any((shots / f'{n}{e}').exists() for e in ('.jpg', '.jpeg', '.png'))]
        if absent:
            print(f'PERINGATAN — {len(absent)} dari {len(wanted)} gambar tidak ada di {shots}: '
                  f'{", ".join(absent[:8])}{" ..." if len(absent) > 8 else ""}')
    date = m.get('date', '')
    title = m.get('title', 'Laporan QC')

    def header_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Courier', 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 12 * mm, f'{title}  |  {date}')
        canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f'Hal. {doc.page}')
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(18 * mm, 15.5 * mm, A4[0] - 18 * mm, 15.5 * mm)
        canvas.restoreState()

    doc = BaseDocTemplate(str(out), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=20 * mm, title=title)
    doc.addPageTemplates([PageTemplate(
        id='all', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)],
        onPage=header_footer)])
    W, story = doc.width, []

    # --- cover ---
    if m.get('kicker'):
        story.append(Paragraph(to_para(m['kicker']), S['kicker']))
    story.append(Paragraph(to_para(title), S['title']))
    if m.get('scope'):
        story.append(Paragraph(to_para(m['scope']), S['lede']))

    def stat(value, label, color=None):
        # Two stacked paragraphs, not one with <br/>: a 19pt run inside a
        # 10pt-leading style makes reportlab under-measure the row, and the
        # label spills out of the box onto whatever follows.
        num = st('stat', fontSize=19, leading=22, textColor=color or INK,
                 fontName='Helvetica-Bold')
        cap = st('statcap', fontSize=7.5, leading=9.5, textColor=MUTED)
        inner = Table([[Paragraph(str(value), num)], [Paragraph(label, cap)]])
        inner.setStyle(TableStyle(NOPAD))
        return inner

    tiles = [stat(sc['executed'], 'Test case dijalankan'),
             stat(sc['passed'], 'Akhirnya lolos', OK),
             stat(sc['failed_first'], 'Gagal di percobaan pertama', FAIL),
             stat(sc['bugs'], 'Bug diperbaiki', WARN)]
    if sc['not_run']:
        tiles.append(stat(sc['not_run'], 'Belum diuji', MUTED))
    story.append(boxed([tiles], [W / len(tiles)] * len(tiles),
                       extra=[('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                              ('TOPPADDING', (0, 0), (-1, -1), 8),
                              ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    story.append(Spacer(1, 10))

    for para in m.get('summary', []):
        story.append(Paragraph(to_para(para), S['body']))

    # --- bugs ---
    if m.get('bugs'):
        story.append(Paragraph('Bug yang ditemukan &amp; diperbaiki', S['h2']))
        for b in m['bugs']:
            head = Table([[Paragraph(f"<b>{b['id']}</b> &nbsp;&middot;&nbsp; {to_para(b['title'])}", S['cell']),
                           Paragraph(f'<para align="right"><font color="#{OK.hexval()[2:]}">'
                                     f"{b.get('status', 'SUDAH DIPERBAIKI')}</font></para>", S['cell'])]],
                         colWidths=[W * 0.72, W * 0.28])
            head.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), SOFT),
                ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
            rows = [(k.upper(), b[f]) for k, f in
                    [('sifat', 'sifat'), ('menggagalkan', 'cases'), ('gejala', 'gejala'),
                     ('sebab', 'sebab'), ('cakupan', 'cakupan'), ('perbaikan', 'perbaikan')]
                    if b.get(f)]
            body = boxed([[Paragraph(k, S['th']), Paragraph(to_para(v), S['cell'])] for k, v in rows],
                         [W * 0.18, W * 0.82])
            story.append(KeepTogether([Spacer(1, 6), head, body]))

    # --- results table ---
    story.append(CondPageBreak(120 * mm))
    story.append(Paragraph('Hasil per test case', S['h2']))
    legend = Table([[dots('f'), Paragraph('percobaan gagal (bug aplikasi)', S['cap']),
                     dots('t'), Paragraph('gagal karena kendala alat uji, bukan bug', S['cap']),
                     dots('p'), Paragraph('percobaan lolos', S['cap'])]],
                   colWidths=[5 * mm, 42 * mm, 5 * mm, 55 * mm, 5 * mm, 30 * mm])
    legend.setStyle(TableStyle(NOPAD + [('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    story.append(legend)

    data = [[Paragraph(h, S['th']) for h in
             ('ID', 'SKENARIO', 'PERCOBAAN', 'CATATAN: KENAPA GAGAL &amp; APA PERBAIKANNYA', 'STATUS')]]
    cmds = [('LINEBELOW', (0, 0), (-1, 0), 0.6, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]
    r = 1
    for c in m.get('cases', []):
        if 'id' not in c:
            data.append([Paragraph(c['section'], S['sec']), '', '', '', ''])
            cmds += [('SPAN', (0, r), (-1, r)), ('BACKGROUND', (0, r), (-1, r), SOFT)]
        else:
            attempts = c.get('attempts', '')
            passed = attempts.endswith('p')
            label, colr, bg = (('Pass', OK, OKBG) if passed else
                               ('Belum diuji', MUTED, colors.white) if not attempts else
                               ('Fail', FAIL, colors.HexColor('#FBEBEA')))
            data.append([
                Paragraph(c['id'], st('x', fontName='Courier', fontSize=7.4, textColor=MUTED)),
                Paragraph(to_para(c['title']), S['cellb']),
                dots(attempts) if attempts else Paragraph('&ndash;', S['cell']),
                Paragraph(to_para(c.get('note', '')), S['cell']),
                Paragraph(f'<para align="center"><font color="#{colr.hexval()[2:]}">{label}</font></para>',
                          S['cell'])])
            cmds += [('LINEBELOW', (0, r), (-1, r), 0.3, LINE), ('BACKGROUND', (4, r), (4, r), bg)]
            if 'f' in attempts:
                cmds.append(('BACKGROUND', (0, r), (0, r), colors.HexColor('#FBEBEA')))
        r += 1
    tbl = Table(data, colWidths=[W * .055, W * .175, W * .075, W * .605, W * .09], repeatRows=1)
    tbl.setStyle(TableStyle(cmds))
    story.append(tbl)

    # --- visual evidence ---
    cases_with_steps = [c for c in m.cases if c.get('steps')]
    if cases_with_steps and shots:
        story.append(CondPageBreak(150 * mm))
        story.append(Paragraph('Bukti visual langkah per langkah', S['h2']))
        story.append(Paragraph(
            'Setiap test case direkam per langkah, bukan hanya hasil akhirnya, supaya alurnya '
            'bisa ditelusuri ulang oleh orang lain.', S['small']))

        # Layout is manifest-driven. Phone screenshots read fine four to a row;
        # desktop pages full of numbers do not -- set "shots_per_row": 1 and each
        # step gets its own row, the image spanning the content width (never past
        # the page margins) with its caption above it.
        per_row = max(1, int(m.get('shots_per_row', PER_ROW)))
        shot_w = SHOT_W if per_row == PER_ROW else (W / per_row) - (0 if per_row == 1 else 4)
        max_h = 185 * mm  # a full-page capture must still fit one page with its caption

        def cell(step, idx):
            cap = Paragraph(f"<b>{idx}.</b> {to_para(step['cap'])}", S['cap'])
            inner = [cap]
            for ext in ('.jpg', '.jpeg', '.png'):
                p = shots / f"{step['img']}{ext}"
                if p.exists():
                    img = Image(str(p))
                    w = shot_w - (1 if per_row == 1 else 0)
                    h = w * img.imageHeight / img.imageWidth
                    if h > max_h:
                        w, h = w * max_h / h, max_h
                    img.drawWidth, img.drawHeight = w, h
                    if per_row == 1:
                        framed = Table([[img]], colWidths=[shot_w])
                        framed.setStyle(TableStyle(NOPAD + [
                            ('BOX', (0, 0), (-1, -1), 0.5, LINE), ('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
                        inner = [cap, Spacer(1, 3), framed]
                    else:
                        inner = [img, Spacer(1, 2), cap]
                    break
            t = Table([[i] for i in inner], colWidths=[shot_w])
            t.setStyle(TableStyle(NOPAD + [('VALIGN', (0, 0), (-1, -1), 'TOP')]))
            return t

        for c in cases_with_steps:
            head = Table([[Paragraph(f"<b>{c['id']}</b> &nbsp;&middot;&nbsp; {to_para(c['title'])}", S['cell']),
                           Paragraph(f"<para align=\"right\">{to_para(c.get('verdict', ''))}</para>", S['cap'])]],
                         colWidths=[W * 0.55, W * 0.45])
            head.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), SOFT),
                ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
            block = [Spacer(1, 8), head, Spacer(1, 5)]
            steps = c['steps']
            if per_row == 1:
                # One step per row: keep caption + image together, let steps flow
                # across pages instead of forcing the whole case onto one page.
                story.append(CondPageBreak(60 * mm))
                story.extend(block)
                for n, s in enumerate(steps, start=1):
                    story.append(KeepTogether([cell(s, n), Spacer(1, 10)]))
                continue
            for i in range(0, len(steps), per_row):
                chunk = steps[i:i + per_row]
                cells = [cell(s, i + j + 1) for j, s in enumerate(chunk)]
                cells += [''] * (per_row - len(cells))
                grid = Table([cells], colWidths=[W / per_row] * per_row)
                grid.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
                block.append(grid)
            story.append(CondPageBreak(85 * mm))
            story.extend(block)

    # --- notes / tooling / honesty ---
    if m.get('notes'):
        story.append(CondPageBreak(90 * mm))
        story.append(Paragraph('Catatan tambahan', S['h2']))
        story.append(Paragraph('Ditemukan di luar cakupan test case, tapi layak ditindaklanjuti.', S['small']))
        for n in m['notes']:
            story.append(Paragraph(f"{n['id']} &mdash; {to_para(n['title'])}", S['h3']))
            story.append(Paragraph(to_para(n['body']), S['body']))

    if m.get('tooling_problems'):
        story.append(Paragraph('Kendala alat uji selama pengujian', S['h2']))
        story.append(Paragraph(
            'Dicatat supaya jelas mana yang cacat aplikasi dan mana yang bukan. '
            'Tidak satu pun dari ini dihitung sebagai kegagalan test case:', S['small']))
        for t in m['tooling_problems']:
            story.append(Paragraph(f'&bull; {to_para(t)}', S['body']))

    if m.get('honesty'):
        story.append(Paragraph('Catatan kejujuran', S['h2']))
        story.append(Paragraph(to_para(m['honesty']), S['body']))

    if m.get('environment'):
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"Lingkungan uji: {to_para(m['environment'])}.", S['small']))

    doc.build(story)
    print(f'PDF dibuat: {out} ({os.path.getsize(out)} byte)')
    print(f"Scoreboard: {sc['executed']} dijalankan, {sc['passed']} lolos, "
          f"{sc['failed_first']} gagal di percobaan pertama, {sc['not_run']} belum diuji")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    build(sys.argv[1])
