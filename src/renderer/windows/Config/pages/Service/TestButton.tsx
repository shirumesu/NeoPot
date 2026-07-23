import { Button } from '@heroui/react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

interface TestButtonProps {
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  onTest: () => Promise<unknown>
}

export default function TestButton({ isLoading, setIsLoading, onTest }: TestButtonProps) {
  const { t } = useTranslation()

  async function runTest() {
    setIsLoading(true)
    try {
      await onTest()
      toast.success(t('config.service.test_success'))
    } catch (error) {
      toast.error(t('config.service.test_failed') + String(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      onPress={() => {
        void runTest()
      }}
      isLoading={isLoading}
      fullWidth
    >
      {t('common.test')}
    </Button>
  )
}
