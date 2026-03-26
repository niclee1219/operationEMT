import { useEffect, useRef, useCallback } from 'react'

const OPERATOR_ID = 'op-001'  // MVP: hardcoded operator

export default function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const reconnectDelay = useRef(1000)
  const unmounted = useRef(false)

  const connect = useCallback(() => {
    if (unmounted.current) return
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/dashboard/${OPERATOR_ID}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      reconnectDelay.current = 1000  // reset backoff
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessage(msg)
      } catch (e) {
        console.error('[WS] Parse error', e)
      }
    }

    ws.onclose = () => {
      console.log('[WS] Closed, reconnecting in', reconnectDelay.current, 'ms')
      if (!unmounted.current) {
        setTimeout(connect, reconnectDelay.current)
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
      }
    }

    ws.onerror = (e) => {
      console.error('[WS] Error', e)
      ws.close()
    }
  }, [onMessage])

  useEffect(() => {
    connect()
    return () => {
      unmounted.current = true
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, operator_id: OPERATOR_ID, ...payload }))
    }
  }, [])

  return { sendMessage }
}
