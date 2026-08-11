import { useParams } from 'react-router-dom'

function ClothingDetail() {
  const { id } = useParams()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Kıyafet Detayı</h1>
      <p className="mt-2 text-gray-600">Kıyafet #{id} için detaylar burada gösterilecek.</p>
    </div>
  )
}

export default ClothingDetail
