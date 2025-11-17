interface FormAlertProps {
  type: "success" | "error" | "info";
  message: string;
}

export function FormAlert({ type, message }: FormAlertProps) {
  const colors = {
    success: "bg-green-100 text-green-700 border-green-300",
    error: "bg-red-100 text-red-700 border-red-300",
    info: "bg-blue-100 text-blue-700 border-blue-300",
  };

  return (
    <div
      className={`w-full px-4 py-3 rounded-lg border ${colors[type]} mb-4 text-sm font-medium`}
    >
      {message}
    </div>
  );
}
