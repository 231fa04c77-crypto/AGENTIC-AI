import React from 'react'
import { useNavigate } from 'react-router-dom'

const HealthQueriesSection = () => {
  const navigate = useNavigate()

  const queries = [
    {
      title: 'What are the early signs of diabetes?',
      views: 1250,
      category: 'General Health',
      lastUpdated: '2 hours ago',
      preview: 'Understanding early symptoms can help in early detection...'
    },
    {
      title: 'How to manage stress and anxiety naturally?',
      views: 890,
      category: 'Mental Health',
      lastUpdated: '5 hours ago',
      preview: 'Natural remedies and lifestyle changes for better mental health...'
    },
    {
      title: 'Best diet for PCOS patients',
      views: 2100,
      category: 'Women\'s Health',
      lastUpdated: '1 day ago',
      preview: 'Nutritional guidelines and meal plans for PCOS management...'
    },
    {
      title: 'When to see a doctor for persistent cough?',
      views: 1560,
      category: 'Respiratory',
      lastUpdated: '3 hours ago',
      preview: 'Warning signs that indicate you need medical attention...'
    },
    {
      title: 'Understanding blood pressure readings',
      views: 980,
      category: 'Cardiology',
      lastUpdated: '6 hours ago',
      preview: 'Learn what your BP numbers mean and when to worry...'
    },
    {
      title: 'Skin care routine for acne-prone skin',
      views: 3200,
      category: 'Dermatology',
      lastUpdated: '1 day ago',
      preview: 'Expert tips and product recommendations for clear skin...'
    }
  ]

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Health Queries & Community
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore common health questions answered by our medical experts
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {queries.map((query, index) => (
            <div
              key={index}
              onClick={() => navigate(`/health-queries/${index}`)}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer border border-gray-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-full">
                  {query.category}
                </span>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {query.views.toLocaleString()}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-cyan-600 transition-colors">
                {query.title}
              </h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {query.preview}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Updated {query.lastUpdated}
                </span>
                <button className="text-cyan-600 hover:text-cyan-700 font-medium text-sm group-hover:underline">
                  View more →
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/health-queries')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
          >
            View all Health Queries
          </button>
        </div>
      </div>
    </section>
  )
}

export default HealthQueriesSection

