import type { ProcessImageJob, ProcessImageResult, WorkerRequest, WorkerResponse } from './worker'

export class ImageProcessingWorker {
  private worker: Worker
  private successHandlers = new Map<string, (r: WorkerResponse) => void>()
  private errorHandlers = new Map<string, (message: string) => void>()

  public constructor() {
    this.worker = new Worker(
      URL.createObjectURL(new Blob([`<WORKER_SOURCE_CODE>`], { type: 'application/javascript' })),
      {
        type: 'module',
      },
    )
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      switch (msg.type) {
        case 'processImageResult':
        case 'success':
          this.successHandlers.get(msg.id)?.(msg)
          break
        case 'error':
          this.errorHandlers.get(msg.id)?.(msg.message)
          this.successHandlers.delete(msg.id)
          break
      }
      this.successHandlers.delete(msg.id)
      this.errorHandlers.delete(msg.id)
    }
    this.worker.onerror = (error) => console.log('BOT WORKER ERROR', error)
    this.worker.onmessageerror = (error) => console.log('BOT WORKER MESSAGE ERROR', error)
  }

  private post<T>(msg: WorkerRequest, transfer: Transferable[] = []): Promise<any> {
    return new Promise<T>((resolve, reject) => {
      this.successHandlers.set(msg.id, resolve as any)
      this.errorHandlers.set(msg.id, reject)
      this.worker.postMessage(msg, transfer)
    })
  }

  public register(name: string, blob: Blob): Promise<void> {
    return this.post({ type: 'register', id: crypto.randomUUID(), blob, name })
  }

  public clearMapCache() {
    return this.post({ type: 'clear-map-cache', id: crypto.randomUUID() })
  }

  public process(job: Omit<ProcessImageJob, 'type' | 'id'>): Promise<ProcessImageResult> {
    return this.post({ type: 'process', id: crypto.randomUUID(), ...job })
  }
}
