import { getData } from '@/context/userContext'
import React from 'react'
import { Navigate } from 'react-router-dom'
import Loader from "@/components/Loader"


const ProtectedRoute = ({children}) => {
    const {user, loading} = getData();

      if (loading) {
    return <Loader />
  }
   if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute;
