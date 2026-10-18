import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/lib/api-client'

/** Loads a list once and exposes `reload` for after mutations. */
export function useList<T>(loader: () => Promise<T[]>) {
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setItems(await loaderRef.current())
      setError('')
    } catch (err) {
      setError(errorMessage(err, 'Failed to load data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { items, loading, error, reload }
}
