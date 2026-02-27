export type FlightSocketHandlers = {
  onMessage: (payload: unknown) => void;
};

export function connectFlightSocket(url: string, handlers: FlightSocketHandlers): WebSocket {
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    handlers.onMessage(event.data);
  };
  return socket;
}
