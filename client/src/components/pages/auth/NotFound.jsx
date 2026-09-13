import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

const NotFound = () => {
  const navigate = useNavigate()   

  return (
    <div className="w-full h-screen flex items-center justify-center bg-neutral-900 text-neutral-200">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-white">404</h1>
        <p className="text-lg text-white">
          Page not found
        </p>
        <Button
          className="bg-green-600 hover:bg-green-500"
          onClick={() => navigate("/")}
        >
          Go Home
        </Button>
      </div>
    </div>
  )
}

export default NotFound
