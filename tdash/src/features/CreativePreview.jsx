import React, { useState } from 'react';
import { Copy, RefreshCw, Share2, Image as ImageIcon, Twitter, Linkedin, Instagram, TrendingUp, Sparkles, MessageSquare } from 'lucide-react';

const CreativePreview = ({ result, isGenerating, isDark }) => {
    const [activeTab, setActiveTab] = useState('instagram');

    if (isGenerating) {
        return (
            <div className={`h-full rounded-2xl flex flex-col items-center justify-center p-8 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white shadow-sm'}`}>
                <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full animate-spin border-t-transparent"></div>
                </div>
                <h3 className={`text-xl font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Crafting your strategy...</h3>
                <p className={`text-center max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Analyzing virality potential and generating multi-platform content.
                </p>
            </div>
        );
    }

    if (!result) {
        return (
            <div className={`h-full rounded-2xl flex flex-col items-center justify-center p-8 border-2 border-dashed ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-[#252525] text-gray-600' : 'bg-gray-200 text-gray-400'}`}>
                    <ImageIcon size={32} />
                </div>
                <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Enter a prompt and adjust the sliders to generate a preview.
                </p>
            </div>
        );
    }

    const tabs = [
        { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
        { id: 'twitter', label: 'Twitter', icon: Twitter, color: 'text-blue-400' },
        { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
    ];

    const currentContent = result.platforms[activeTab];

    return (
        <div className={`h-full rounded-2xl flex flex-col ${isDark ? 'bg-[#1e1e1e]' : 'bg-white shadow-sm'} overflow-hidden`}>
            {/* Header with Tabs */}
            <div className={`border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                <div className="flex px-6 pt-6 space-x-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 flex items-center space-x-2 border-b-2 transition-all ${activeTab === tab.id
                                ? `border-indigo-500 ${isDark ? 'text-white' : 'text-gray-900'}`
                                : `border-transparent ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`
                                }`}
                        >
                            <tab.icon size={18} className={activeTab === tab.id ? tab.color : ''} />
                            <span className="font-medium text-sm">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Content Card */}
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'instagram' ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' :
                                    activeTab === 'twitter' ? 'bg-blue-400' : 'bg-blue-600'
                                } text-white`}>
                                {activeTab === 'instagram' && <Instagram size={16} />}
                                {activeTab === 'twitter' && <Twitter size={16} />}
                                {activeTab === 'linkedin' && <Linkedin size={16} />}
                            </div>
                            <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>TixMo Official</span>
                        </div>
                        <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#333] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Copy size={16} />
                        </button>
                    </div>

                    <p className={`whitespace-pre-wrap leading-relaxed text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {currentContent.text}
                    </p>

                    {currentContent.hashtags && currentContent.hashtags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {currentContent.hashtags.map(tag => (
                                <span key={tag} className={`text-xs ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {result.visuals && result.visuals.previewUrl && (
                        <div className="mt-4 rounded-lg overflow-hidden aspect-video relative">
                            <img
                                src={result.visuals.previewUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </div>

                {/* Strategy & Virality */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Virality Score */}
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp size={16} className="text-green-500" />
                            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Virality Potential</h4>
                        </div>
                        <div className="flex items-end space-x-2 mb-2">
                            <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{result.strategy?.viralityScore || 0}</span>
                            <span className={`text-sm mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/100</span>
                        </div>
                        <div className="h-2 w-full bg-gray-200/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                                style={{ width: `${result.strategy?.viralityScore || 0}%` }}
                            />
                        </div>
                    </div>

                    {/* AI Insight */}
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center space-x-2 mb-2">
                            <Sparkles size={16} className="text-purple-500" />
                            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Strategy Insight</h4>
                        </div>
                        <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {result.strategy?.explanation}
                        </p>
                    </div>
                </div>

                {/* Visual Prompt */}
                <div className={`p-4 rounded-xl border ${isDark ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-100 bg-indigo-50/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <ImageIcon size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                            <h4 className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Suggested Visual Prompt</h4>
                        </div>
                        <button className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}>
                            <Copy size={14} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                        </button>
                    </div>
                    <code className={`block text-xs font-mono p-2 rounded bg-black/5 dark:bg-black/20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {result.visuals?.imagePrompt}
                    </code>
                </div>
            </div>

            <div className={`p-6 border-t ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    <Share2 size={18} />
                    <span>Schedule to {tabs.find(t => t.id === activeTab).label}</span>
                </button>
            </div>
        </div>
    );
};

export default CreativePreview;
