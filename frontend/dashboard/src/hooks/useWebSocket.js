import { useEffect, useRef, useCallback, useState } from 'react'

const OPERATOR_ID = 'op-001'  // MVP: hardcoded operator

export default function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const reconnectDelay = useRef(1000)
  const unmounted = useRef(false)
  const onMessageRef = useRef(onMessage)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // Keep ref current so connect() closure never captures a stale onMessage
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (unmounted.current) return
    setConnectionStatus('connecting')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/dashboard/${OPERATOR_ID}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      reconnectDelay.current = 1000  // reset backoff
      setConnectionStatus('open')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessageRef.current(msg)
      } catch (e) {
        console.error('[WS] Parse error', e)
      }
    }

    ws.onclose = () => {
      if (!unmounted.current) {
        console.log('[WS] Closed, reconnecting in', reconnectDelay.current, 'ms')
        setConnectionStatus('connecting')
        setTimeout(connect, reconnectDelay.current)
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
      } else {
        setConnectionStatus('closed')
      }
    }

    ws.onerror = (e) => {
      console.error('[WS] Error', e)
      // WebSocket spec closes automatically after an error event; no explicit close needed
    }
  }, [])

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
    } else {
      console.warn('sendMessage: WebSocket not open, message dropped:', type)
    }
  }, [])

  return { connectionStatus, sendMessage }
}
