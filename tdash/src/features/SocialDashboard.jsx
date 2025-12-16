import React, { useState, useMemo } from 'react';
import { Filter, Instagram, Twitter, Facebook, Linkedin, LayoutGrid, ChevronDown } from 'lucide-react';
import SocialPostCard from './SocialPostCard';
import SocialPostModal from './SocialPostModal';
import { MOCK_SOCIAL_POSTS, MOCK_EVENTS } from '../data/mockData';

const SocialDashboard = ({ isDark }) => {
    const [selectedEventId, setSelectedEventId] = useState('all');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [selectedPost, setSelectedPost] = useState(null);

    const filteredPosts = useMemo(() => {
        return MOCK_SOCIAL_POSTS.filter(post => {
            const eventMatch = selectedEventId === 'all' || post.eventId === selectedEventId;
            const platformMatch = selectedPlatform === 'all' || post.platform === selectedPlatform;
            return eventMatch && platformMatch;
        });
    }, [selectedEventId, selectedPlatform]);

    const platforms = [
        { id: 'all', label: 'All', icon: LayoutGrid },
        { id: 'instagram', label: 'Instagram', icon: Instagram },
        { id: 'twitter', label: 'Twitter', icon: Twitter },
        { id: 'facebook', label: 'Facebook', icon: Facebook },
        { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    ];

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {selectedPost && (
                <SocialPostModal
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                    isDark={isDark}
                />
            )}

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Social Pulse</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>Monitor social engagement across all your events.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Event Dropdown */}
                    <div className="relative group">
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className={`appearance-none pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer transition-all shadow-sm ${isDark ? 'bg-[#1e1e1e] text-gray-200 hover:bg-[#252525] border border-[#333]' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
                        >
                            <option value="all">All Events</option>
                            {MOCK_EVENTS.map(event => (
                                <option key={event.id} value={event.id}>{event.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>

                    {/* Platform Filters */}
                    <div className={`flex p-1 rounded-xl ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white border border-gray-200'}`}>
                        {platforms.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedPlatform(p.id)}
                                className={`p-2 rounded-lg transition-all ${selectedPlatform === p.id
                                        ? (isDark ? 'bg-[#333] text-white shadow-sm' : 'bg-gray-100 text-gray-900 shadow-sm')
                                        : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
                                    }`}
                                title={p.label}
                            >
                                <p.icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Masonry Grid */}
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                {filteredPosts.map(post => (
                    <SocialPostCard
                        key={post.id}
                        post={post}
                        onClick={setSelectedPost}
                        isDark={isDark}
                    />
                ))}
            </div>

            {filteredPosts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <Filter size={48} className={isDark ? 'text-gray-700' : 'text-gray-300'} />
                    <p className={`mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No posts found for this filter.</p>
                </div>
            )}
        </div>
    );
};

export default SocialDashboard;
