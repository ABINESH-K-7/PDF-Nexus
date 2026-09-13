const profilePhotoKeys = ["avatar", "photoURL", "photoUrl", "picture", "profilePhoto", "image"]

export function getDisplayName(user) {
  const explicitName = [user?.name, user?.username, user?.displayName, user?.profile?.name, user?.profile?.username]
    .find((value) => typeof value === "string" && value.trim())
  if (explicitName) return explicitName.trim()

  const emailLocalPart = typeof user?.email === "string" ? user.email.split("@")[0] : ""
  if (!emailLocalPart) return "My Files"
  return emailLocalPart
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1).toLowerCase()}`)
    .join(" ")
}

export function getUserProfilePhoto(user) {
  return profilePhotoKeys
    .flatMap((key) => [user?.[key], user?.profile?.[key]])
    .find((value) => typeof value === "string" && value.trim()) || ""
}
