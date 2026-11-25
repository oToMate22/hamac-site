// Modules virtuels fournis par vite.ssr.config.ts au moment du build serveur.
declare module 'virtual:hamac-shell' {
  /** dist/index.html (shell Vite avec les assets hachés, la CMP et le script principal). */
  const shell: string
  export default shell
}

declare module 'virtual:hamac-default-og' {
  /** public/images/og/hamac-og-1200x630.jpg encodé en base64 (image de secours). */
  const base64: string
  export default base64
}
