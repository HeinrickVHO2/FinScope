interface AlertBannerProps {
  type?: "info" | "success" | "warning" | "error";
  message: string;
}

const colors = {
  info: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300"
  },
  success: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300"
  },
  warning: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-300"
  },
  error: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-300"
  }
};

export function AlertBanner({ type = "info", message }: AlertBannerProps) {
  const c = colors[type];

  return (
    <div
      className={`${c.bg} ${c.text} ${c.border} border px-4 py-3 rounded-lg mb-4 text-sm font-medium`}
    >
      {message}
    </div>
  );
}
