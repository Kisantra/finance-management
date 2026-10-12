/** Gambar yang diimpor langsung (Remotion/webpack dan Vite sama-sama mengembalikan URL). */
declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.wav' {
    const src: string;
    export default src;
}

declare module '*.mp3' {
    const src: string;
    export default src;
}

declare module '*.webp' {
    const src: string;
    export default src;
}

declare module '*.css';
