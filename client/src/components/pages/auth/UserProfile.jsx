import { getData } from "@/context/userContext"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { API_URL } from "../../../config/api"
import { toast } from "react-hot-toast"

export default function UserProfile() {
  const { user, setUser } = getData()
  const navigate = useNavigate()

 const handleLogout = async () => {
  const accessToken = localStorage.getItem("accessToken");

  // If no token, force logout locally
  if (!accessToken) {
    setUser(null);
    navigate("/login");
    return;
  }

  try {
    const res = await axios.post(
      `${API_URL}/user/logout`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (res.data.success) {
      toast.success(res.data.message);
    }
  } catch (error) {
    toast.error(
      error.response?.data?.message || "Logout failed"
    );
  } finally {
    // 🔥 ALWAYS clean up locally
    // localStorage.removeItem("accessToken");
    localStorage.clear()
    setUser(null);
    // navigate("/login");
    window.location.href = "/login"
  }
};

  if (!user) return null

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200
                    flex items-center justify-center">
      <div
        className="relative bg-neutral-800 p-6 rounded-xl w-[320px]
                   border border-neutral-700 text-center space-y-4"
      >
        {/* ❌ CLOSE / BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          title="Back"
          className="absolute top-3 right-3 p-1 rounded
                     hover:bg-red-900 transition"
        >
          <svg
            className="w-5 h-5 fill-white"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
          >
            <polygon points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49" />
          </svg>
        </button>

        {/* AVATAR */}
       {user.avatar ? (
  <img
    src={user.avatar}
    alt="avatar"
    className="w-20 h-20 aspect-square rounded-full mx-auto overflow-hidden
               border border-neutral-600 object-cover"
  />
) : (
  <div
    className="w-20 h-20 rounded-full mx-auto
               bg-neutral-700 border border-neutral-600
               flex items-center justify-center"
  >
    <svg
      viewBox="0 0 16 16"
      className="w-10 h-10 fill-white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 1c-1.65625 0-3 1.34375-3 3s1.34375 3 3 3 3-1.34375 3-3-1.34375-3-3-3zm-1.5 7C4.008 8 2 10.007812 2 12.5v.5c0 1.109375.890625 2 2 2h8c1.109375 0 2-.890625 2-2v-.5C14 10.007812 11.992188 8 9.5 8z" />
    </svg>
  </div>
)}


        <h2 className="text-lg font-semibold">{user.username}</h2>
        <p className="text-sm text-neutral-400">{user.email}</p>

        <button
          onClick={handleLogout}
          className="w-full mt-4 py-2 rounded
                     bg-red-600 hover:bg-red-700 transition"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
