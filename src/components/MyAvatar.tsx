import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export const MyAvatar = () => (
  <Avatar className="h-32 w-32 border-4 border-gray-300">
    <AvatarImage
      src="https://avatars.githubusercontent.com/u/25991?v=4"
      alt="Andrei Railean"
    />
    <AvatarFallback>AR</AvatarFallback>
  </Avatar>
)
