import { Files } from "lucide-react"

export default function ActivityBar({ onToggleSidebar }) {
  return (
    <div
      className="h-12 w-full shrink-0 bg-[#333333] border-b border-neutral-800
                 flex flex-row items-center px-3 md:h-auto md:w-12 md:flex-col md:border-b-0 md:border-r md:py-3"
    >
      {/* TOP: Explorer */}
      <button
        onClick={onToggleSidebar}
        title="Explorer"
        className="p-2 rounded hover:bg-neutral-700 text-neutral-300"
      >
        <Files size={20} strokeWidth={1.6} />
      </button>
    </div>
  )
}
