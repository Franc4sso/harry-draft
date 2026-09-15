'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Misura l'altezza VISIBILE di un contenitore (la sua `clientHeight`, cioè quanto
 * spazio ha davvero in viewport), ri-misurando a ogni resize e a ogni cambio di
 * dimensione dell'elemento.
 *
 * Perché serve: la mappa della run disegna i piani a passo fisso (`ROW = 148px`).
 * Con 5 piani sono ~784px di soli nodi che, sommati a header e padding, superano
 * l'altezza di un portatile: su 1366x768, 1280x800 e 1536x864 l'ultima fila —
 * quella dei nodi SELEZIONABILI — finiva sotto il bordo dello schermo, costringendo
 * a scorrere per vedere le proprie mosse. Misurando lo spazio reale la mappa può
 * contrarre il passo verticale e stare tutta in pagina.
 *
 * Ritorna `[ref, height]`; `height` è 0 finché non è stata fatta la prima misura,
 * così il chiamante può distinguere "non misurato" e usare il layout a passo pieno.
 */
export function useAvailableHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [h, setH] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      // clientHeight = altezza interna al netto dei bordi: è lo spazio in cui il
      // contenuto deve stare. NON scrollHeight, che cresce col contenuto e
      // renderebbe la misura auto-alimentante.
      const next = Math.max(0, el.clientHeight)
      setH(prev => (prev === next ? prev : next))
    }

    measure()

    // ResizeObserver non esiste in jsdom (e in browser molto vecchi): senza questa
    // guardia il componente esplode sotto test con "ResizeObserver is not defined".
    // Senza l'observer resta comunque il listener di resize — si perde solo la
    // ri-misura sui cambi di contenuto a viewport invariato.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  return [ref, h]
}
