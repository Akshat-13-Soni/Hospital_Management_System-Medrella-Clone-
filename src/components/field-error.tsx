export function FieldError({ messages }: { messages?: string[] }) {
  return messages?.[0] ? <p className="text-sm text-destructive">{messages[0]}</p> : null;
}