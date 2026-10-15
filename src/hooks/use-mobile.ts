import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function assinar(aoMudar: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", aoMudar)
  return () => mql.removeEventListener("change", aoMudar)
}

// useSyncExternalStore: na hidratação usa o valor do servidor (false) e só depois troca para o do navegador.
// Ler `window` já no 1º render fazia o celular montar a árvore diferente do HTML do servidor ("Hydration failed"),
// e o React refazia o <html> do zero, apagando a classe `dark` posta pelo script de tema.
export function useIsMobile() {
  return React.useSyncExternalStore(
    assinar,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
