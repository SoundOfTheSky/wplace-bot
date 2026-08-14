import {
  type WorkerPixelsRequest,
  type WorkerPixelsResponse,
  type WorkerResponse,
} from './worker'

export const worker = new Worker(
  URL.createObjectURL(
    new Blob([`<WORKER_SOURCE_CODE>`], { type: 'application/javascript' }),
  ),
  {
    type: 'module',
  },
)
const pending = new Map<
  number,
  {
    resolve: (data: MessageEvent['data']) => void
    reject: (error: Error) => void
    progress?: (percent: number) => void
  }
>()
let nextId = 0

worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
  const data = pending.get(e.data.id)
  if (data) {
    if ('progress' in e.data) data.progress?.(e.data.progress)
    else if ('error' in e.data) data.reject(new Error(e.data.error))
    else {
      pending.delete(e.data.id)
      data.resolve(e.data)
    }
  }
}

worker.onerror = (e) => {
  console.error('[WORKER ERRROR]', e)
}

worker.onmessageerror = (e) => {
  console.error('[WORKER MESSAGE ERRROR]', e)
}
export function workerPixels(
  _request: Omit<WorkerPixelsRequest, 'id'>,
  progress?: (percent: number) => void,
): Promise<WorkerPixelsResponse> {
  const request = _request as WorkerPixelsRequest
  return new Promise((resolve, reject) => {
    request.id = nextId++
    worker.postMessage(request)
    pending.set(request.id, { resolve, progress, reject })
  })
}

export function workerClearMapCache() {
  worker.postMessage('CLEAR_MAP_CACHE')
}
