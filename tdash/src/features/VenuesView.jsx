import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Search } from 'lucide-react';
import VenueWizard from './VenueWizard';
import api from '../lib/api';

const VenuesView = ({ isDark, user }) => {
    const [showWizard, setShowWizard] = useState(false);
    const [venues, setVenues] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchVenues();
    }, []);

    const fetchVenues = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/venues');
            if (response.data.data && response.data.data.venues) {
                setVenues(response.data.data.venues);
            } else if (Array.isArray(response.data.data)) {
                setVenues(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch venues', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSuccess = () => {
        setShowWizard(false);
        fetchVenues();
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto relative">
            {showWizard && <VenueWizard onClose={() => setShowWizard(false)} onSuccess={handleCreateSuccess} isDark={isDark} user={user} />}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Venues</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm`}>Manage your venue locations and details.</p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-normal rounded-lg transition-all shadow-lg ${isDark ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20' : 'bg-gray-800 text-white hover:bg-gray-700 shadow-gray-400/20'}`}
                >
                    <Plus size={16} />
                    <span>Create Venue</span>
                </button>
            </div>

            {/* List */}
            {isLoading ? (
                <div className={`p-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading venues...</div>
            ) : venues.length === 0 ? (
                <div className={`p-12 text-center rounded-xl border-2 border-dashed ${isDark ? 'border-[#2a2a2a] bg-[#1a1a1a]' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDark ? 'bg-[#252525] text-gray-500' : 'bg-white text-gray-400 shadow-sm'}`}>
                        <MapPin size={32} />
                    </div>
                    <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>No venues found</h3>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Get started by adding your first venue location.</p>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="px-6 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                        Add Venue
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {venues.map((venue) => (
                        <div key={venue.id} className={`p-6 rounded-xl border transition-all hover:scale-[1.01] ${isDark ? 'bg-[#1a1a1a] border-[#333] hover:border-gray-600' : 'bg-white border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{venue.name}</h3>
                                <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-[#252525] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                    {venue.capacity} cap
                                </span>
                            </div>

                            <div className={`space-y-2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                <div className="flex items-start">
                                    <MapPin size={16} className="mr-2 mt-0.5 shrink-0" />
                                    <span>
                                        {venue.address?.street}<br />
                                        {venue.address?.city}, {venue.address?.state} {venue.address?.postalCode}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VenuesView;
