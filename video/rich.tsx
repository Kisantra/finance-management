import * as React from 'react';

/** Render teks panduan: `**tebal**` menjadi <b>. Dipakai video & halaman /panduan (tanpa impor 'remotion'). */
export function Rich({ text }: { text: string }) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return (
        <>
            {parts.map((part, i) =>
                i % 2 ? (
                    <b key={i} className="font-semibold text-ob-ink">
                        {part}
                    </b>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                ),
            )}
        </>
    );
}
