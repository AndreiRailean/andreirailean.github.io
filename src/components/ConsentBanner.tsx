import { useState, useEffect } from "react"
import { Button } from "./ui/button"

const ConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem("analytics_consent")
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const handleAccept = () => {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      })
    }
    localStorage.setItem("analytics_consent", "true")
    setShowBanner(false)
    setTimeout(() => {
      window.location.reload()
    }, 300) // Reload after 300ms to track the page view after consent is set
  }

  if (!showBanner) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 z-1000 w-full bg-gray-100 p-4 text-center text-gray-900 dark:bg-gray-800 dark:text-gray-100">
      <p style={{ margin: 0, paddingBottom: "0.5rem" }}>
        We use cookies to analyze website traffic
      </p>
      <Button onClick={handleAccept}>Accept</Button>
    </div>
  )
}

export default ConsentBanner
