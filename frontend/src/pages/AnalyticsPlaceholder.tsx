import React from 'react';
import { 
  ChartBarIcon, 
  ChartPieIcon, 
  ArrowTrendingUpIcon,
  SparklesIcon,
  BoltIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: ChartBarIcon,
    title: 'Real-time Performance',
    description: 'Track campaign performance with live updates and predictive analytics',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: ChartPieIcon,
    title: 'Advanced Segmentation',
    description: 'Drill down into audience segments and discover hidden opportunities',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: ArrowTrendingUpIcon,
    title: 'ROI Optimization',
    description: 'AI-powered recommendations to maximize your return on ad spend',
    color: 'from-green-500 to-teal-500'
  },
  {
    icon: SparklesIcon,
    title: 'Smart Insights',
    description: 'Get actionable insights powered by machine learning algorithms',
    color: 'from-orange-500 to-red-500'
  }
];

export default function AnalyticsPlaceholder() {
  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="px-4 py-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-32 w-32 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full filter blur-xl opacity-50 animate-pulse"></div>
              </div>
              <BoltIcon className="relative h-24 w-24 text-primary-600 dark:text-primary-400 animate-bounce" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            Analytics Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            Coming Soon
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Get ready for powerful analytics that transform your media buying decisions with real-time insights and AI-driven recommendations.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden"
            >
              {/* Gradient Border Effect */}
              <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                <div className="absolute inset-[2px] bg-white dark:bg-gray-800 rounded-2xl"></div>
              </div>
              
              <div className="relative p-8">
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} text-white mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
                
                <div className="mt-4 flex items-center text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-sm font-medium">Learn more</span>
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <div className="inline-flex items-center px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className="flex space-x-1 mr-3">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse delay-100"></div>
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse delay-200"></div>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Our team is working hard to bring this to you
            </span>
          </div>
          
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            Expected launch: Q1 2025
          </p>
        </div>

        {/* Background Decoration */}
        <div className="fixed top-0 right-0 -z-10 transform rotate-180 opacity-10">
          <svg width="404" height="404" fill="none" viewBox="0 0 404 404">
            <defs>
              <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M0 40L40 0M0 0L40 40" stroke="currentColor" strokeWidth="1" className="text-gray-400" />
              </pattern>
            </defs>
            <rect width="404" height="404" fill="url(#grid)" />
          </svg>
        </div>
      </div>
    </div>
  );
}