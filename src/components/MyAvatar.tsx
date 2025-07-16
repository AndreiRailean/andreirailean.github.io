import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export const MyAvatar = () => (
  <Avatar className="size-32 border-6 border-gray-300 dark:border-gray-300">
    <AvatarImage
      src="https://avatars.githubusercontent.com/u/25991?v=4"
      alt="Andrei Railean"
    />
    <AvatarFallback>AR</AvatarFallback>
  </Avatar>
)
