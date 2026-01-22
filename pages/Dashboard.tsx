
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  LayoutDashboard, 
  Settings, 
  Bell, 
  ChevronRight,
  TrendingUp,
  Package,
  CheckCircle2,
  Wand2,
  Upload,
  ShoppingCart,
  MessageSquare,
  Star,
  X as CloseIcon,
  ArrowRight,
  Crop,
  RotateCw,
  Sun,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole, PetType, Pet } from '../types';
import { generatePetDescription } from '../services/geminiService';

// --- Image Editor Component ---
const ImageEditor = ({ 
  src, 
  onSave, 
  onClose 
}: { 
  src: string; 
  onSave: (editedSrc: string) => void; 
  onClose: () => void 
}) => {
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const applyChanges = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to a standard square for pet cards
    const size = 800;
    canvas.width = size;
    canvas.height = size;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    
    // Draw centered
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    
    onSave(canvas.toDataURL('image/jpeg', 0.8));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        <div className="flex-grow bg-stone-900 p-8 flex items-center justify-center min-h-[400px]">
          <div className="relative overflow-hidden rounded-2xl border-2 border-orange-500/50 shadow-2xl" 
               style={{ width: '350px', height: '350px' }}>
            <img 
              ref={imgRef}
              src={src} 
              alt="To edit"
              className="absolute transition-all duration-100"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                maxWidth: 'none',
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <div className="absolute inset-0 border-2 border-white/30 pointer-events-none grid grid-cols-3 grid-rows-3">
              {[...Array(9)].map((_, i) => <div key={i} className="border border-white/10" />)}
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 bg-white p-8 space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">Edit Photo</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><CloseIcon /></button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                <RotateCw size={14} /> Rotation ({rotation}°)
              </label>
              <input 
                type="range" min="0" max="360" step="90" 
                value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-orange-500" 
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                <Plus size={14} /> Zoom ({zoom.toFixed(1)}x)
              </label>
              <input 
                type="range" min="1" max="3" step="0.1" 
                value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-orange-500" 
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                <Sun size={14} /> Brightness
              </label>
              <input 
                type="range" min="50" max="150" 
                value={brightness} onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-orange-500" 
              />
            </div>
          </div>

          <div className="pt-8 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3 bg-gray-50 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={applyChanges}
              className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all"
            >
              Apply
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---
const Dashboard = () => {
  const { user, pets, orders, deletePet, addPet, addFeedback } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  
  // Editor State
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feedback State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);

  // Form State
  const [newPet, setNewPet] = useState<Partial<Pet>>({
    type: PetType.DOG,
    breed: '',
    age: '',
    gender: 'Male',
    price: 0,
    location: '',
    isVaccinated: true,
    hasCertificate: true,
    description: '',
    images: [],
    availability: 'Available'
  });

  if (!user) return <div className="p-20 text-center">Please login to view dashboard</div>;

  const sellerPets = pets.filter(p => p.sellerId === user.id);
  const customerOrders = orders.filter(o => o.customerId === user.id);

  const handleAddPet = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      addPet({
        ...newPet as Pet,
        sellerId: user.id,
        sellerName: user.name,
        images: newPet.images?.length ? newPet.images : ['https://picsum.photos/seed/placeholder/800/600']
      });
      setShowAddModal(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setNewPet({
      type: PetType.DOG,
      breed: '',
      age: '',
      gender: 'Male',
      price: 0,
      location: '',
      isVaccinated: true,
      hasCertificate: true,
      description: '',
      images: [],
      availability: 'Available'
    });
    setUploadProgress({});
  };

  const handleAIDescription = async () => {
    if (!newPet.breed || !newPet.age) {
      alert("Please enter breed and age first!");
      return;
    }
    setIsGenerating(true);
    const desc = await generatePetDescription({
      type: newPet.type || 'Dog',
      breed: newPet.breed,
      age: newPet.age
    });
    if (desc) setNewPet(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const processFiles = (files: FileList) => {
    const startIndex = (newPet.images || []).length;
    
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      const currentIndex = startIndex + index;

      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setUploadProgress(prev => ({ ...prev, [currentIndex]: progress }));
      }, 200);

      reader.onloadend = () => {
        setNewPet(prev => ({
          ...prev,
          images: [...(prev.images || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const removeImage = (index: number) => {
    setNewPet(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
    // Clean up progress state
    setUploadProgress(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      addFeedback(rating, comment);
      setIsFeedbackSubmitted(true);
      setComment('');
      setRating(5);
      setTimeout(() => setIsFeedbackSubmitted(false), 3000);
    }
  };

  const updateEditedImage = (editedSrc: string) => {
    if (editingImageIndex === null) return;
    setNewPet(prev => ({
      ...prev,
      images: (prev.images || []).map((img, i) => i === editingImageIndex ? editedSrc : img)
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-72 space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
            <img src={user.avatar} className="w-24 h-24 rounded-full mx-auto border-4 border-orange-50 mb-4" alt="user" />
            <h2 className="text-xl font-bold text-gray-800">{user.name}</h2>
            <p className="text-sm text-gray-400 font-medium">{user.role}</p>
          </div>

          <nav className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutDashboard size={20} /> Overview
            </button>
            <button 
              onClick={() => setActiveTab('items')}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'items' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {user.role === UserRole.SELLER ? <Package size={20} /> : <ShoppingCart size={20} />} 
              {user.role === UserRole.SELLER ? 'My Listings' : 'My Orders'}
            </button>
            {user.role === UserRole.CUSTOMER && (
              <button 
                onClick={() => setActiveTab('feedback')}
                className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'feedback' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <MessageSquare size={20} /> Share Feedback
              </button>
            )}
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Settings size={20} /> Settings
            </button>
          </nav>
        </aside>

        {/* Main Dashboard Area */}
        <main className="flex-grow space-y-8">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-orange-500 p-8 rounded-[2rem] text-white space-y-4 shadow-xl shadow-orange-100">
                  <div className="bg-white/20 p-3 rounded-xl w-fit"><TrendingUp /></div>
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Account Status</p>
                    <h3 className="text-2xl font-bold">Verified {user.role}</h3>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                  <div className="bg-blue-50 text-blue-500 p-3 rounded-xl w-fit"><Package /></div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium">
                      {user.role === UserRole.SELLER ? 'Active Listings' : 'Recent Orders'}
                    </p>
                    <h3 className="text-2xl font-bold text-gray-800">
                      {user.role === UserRole.SELLER ? sellerPets.length : customerOrders.length}
                    </h3>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                  <div className="bg-emerald-50 text-emerald-500 p-3 rounded-xl w-fit"><Bell /></div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium">New Messages</p>
                    <h3 className="text-2xl font-bold text-gray-800">0</h3>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
                  <button className="text-orange-500 text-sm font-bold hover:underline">View All</button>
                </div>
                <div className="p-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        {user.role === UserRole.SELLER ? <Package size={20} /> : <ShoppingCart size={20} />}
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-bold text-gray-800 group-hover:text-orange-500 transition-colors">
                          {user.role === UserRole.SELLER ? 'New listing published' : 'Order confirmation'}
                        </h4>
                        <p className="text-xs text-gray-400">2 hours ago</p>
                      </div>
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-orange-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-gray-800">
                  {user.role === UserRole.SELLER ? 'Manage Listings' : 'My Orders'}
                </h3>
                {user.role === UserRole.SELLER && (
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all"
                  >
                    <Plus size={20} /> Add New Pet
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {user.role === UserRole.SELLER ? (
                  sellerPets.map(pet => (
                    <div key={pet.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6">
                      <img src={pet.images[0]} className="w-24 h-24 rounded-2xl object-cover" alt="pet" />
                      <div className="flex-grow">
                        <h4 className="font-bold text-gray-800 text-lg">{pet.breed}</h4>
                        <div className="flex gap-4 text-sm text-gray-400 mt-1">
                          <span>{pet.type}</span>
                          <span>•</span>
                          <span>{pet.availability}</span>
                          <span>•</span>
                          <span className="text-orange-600 font-bold">₹{pet.price.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors">
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => deletePet(pet.id)}
                          className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  customerOrders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6">
                      <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                        <Package />
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-bold text-gray-800">{order.id}</h4>
                        <p className="text-sm text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">₹{order.total.toLocaleString('en-IN')}</p>
                        <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> {order.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {(user.role === UserRole.SELLER ? sellerPets : customerOrders).length === 0 && (
                  <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">No items found yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'feedback' && user.role === UserRole.CUSTOMER && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h3 className="text-2xl font-bold text-gray-800">Share Your Experience</h3>
              <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
                {isFeedbackSubmitted ? (
                  <div className="text-center py-12 space-y-4 animate-in zoom-in-95 duration-500">
                    <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800">Thank you for your feedback!</h4>
                    <p className="text-gray-500">Your review helps other pet parents find their perfect match.</p>
                  </div>
                ) : (
                  <form onSubmit={handleFeedbackSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`p-2 transition-all ${rating >= star ? 'text-orange-500 scale-110' : 'text-gray-200 hover:text-orange-200'}`}
                          >
                            <Star size={32} fill={rating >= star ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Your Comments</label>
                      <textarea
                        required
                        rows={5}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-200 transition-all"
                        placeholder="Tell us about your experience with Pawfect Match..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all flex items-center gap-2"
                    >
                      Post Review <ArrowRight size={20} />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Pet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar">
            <div className="p-8 border-b border-gray-50 sticky top-0 bg-white/80 backdrop-blur-md z-10 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-800">Add New Pet</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <CloseIcon size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddPet} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Pet Type</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
                    value={newPet.type}
                    onChange={(e) => setNewPet({ ...newPet, type: e.target.value as PetType })}
                  >
                    {Object.values(PetType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Breed</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
                    value={newPet.breed}
                    onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Age</label>
                  <input 
                    type="text" 
                    placeholder="e.g., 3 months"
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
                    value={newPet.age}
                    onChange={(e) => setNewPet({ ...newPet, age: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Price (₹)</label>
                  <input 
                    type="number" 
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
                    value={newPet.price}
                    onChange={(e) => setNewPet({ ...newPet, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-700">Description</label>
                  <button 
                    type="button"
                    onClick={handleAIDescription}
                    disabled={isGenerating}
                    className="text-xs font-bold text-orange-500 flex items-center gap-1 hover:text-orange-600 disabled:opacity-50"
                  >
                    <Wand2 size={14} /> {isGenerating ? 'Generating...' : 'AI Enhance Description'}
                  </button>
                </div>
                <textarea 
                  required
                  rows={4}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
                  value={newPet.description}
                  onChange={(e) => setNewPet({ ...newPet, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="vacc" 
                    checked={newPet.isVaccinated}
                    onChange={(e) => setNewPet({ ...newPet, isVaccinated: e.target.checked })}
                    className="w-5 h-5 accent-orange-500"
                  />
                  <label htmlFor="vacc" className="text-sm font-bold text-gray-700">Vaccinated</label>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="cert" 
                    checked={newPet.hasCertificate}
                    onChange={(e) => setNewPet({ ...newPet, hasCertificate: e.target.checked })}
                    className="w-5 h-5 accent-orange-500"
                  />
                  <label htmlFor="cert" className="text-sm font-bold text-gray-700">Health Certificate</label>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-700">Photos</label>
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-3xl border-2 border-dashed transition-all ${dragActive ? 'border-orange-500 bg-orange-50 scale-[1.02]' : 'border-gray-100 bg-gray-50/30'}`}
                >
                  {newPet.images?.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group shadow-sm border border-gray-100 bg-white">
                      <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="preview" />
                      
                      {/* Upload Progress Overlay */}
                      {uploadProgress[i] !== undefined && uploadProgress[i] < 100 && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-6 h-6 text-orange-500 animate-spin mx-auto" />
                            <span className="text-[10px] font-bold text-orange-500">{Math.round(uploadProgress[i])}%</span>
                          </div>
                        </div>
                      )}

                      {/* Controls Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          type="button"
                          onClick={() => setEditingImageIndex(i)}
                          className="p-2 bg-white text-gray-800 rounded-lg hover:bg-orange-500 hover:text-white transition-all shadow-xl"
                          title="Edit Photo"
                        >
                          <Crop size={16} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => removeImage(i)}
                          className="p-2 bg-white text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-xl"
                          title="Delete Photo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {(!newPet.images || newPet.images.length < 8) && (
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all bg-white hover:bg-orange-50 shadow-sm"
                    >
                      <div className="bg-orange-50 text-orange-500 p-3 rounded-xl">
                        <Upload size={20} />
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold block">Add Photos</span>
                        <span className="text-[8px] text-gray-400">or Drag & Drop</span>
                      </div>
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-8 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all"
                >
                  Post Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {editingImageIndex !== null && (
        <ImageEditor 
          src={newPet.images![editingImageIndex]}
          onSave={updateEditedImage}
          onClose={() => setEditingImageIndex(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
