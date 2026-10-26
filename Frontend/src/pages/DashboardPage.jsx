import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import HomePage from './HomePage.jsx';
import DocumentsListPage from './DocumentsListPage.jsx';
import UploadDocumentPage from './UploadDocumentPage.jsx';
import PeoplePage from './PeoplePage.jsx';
import ProfilePage from './ProfilePage.jsx';
import InsurancePage from './InsurancePage.jsx';
import AiChatPage from './AiChatPage.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('insurance_portal_active_tab') || 'home';
    } catch {
      return 'home';
    }
  });
  const [chatInitialContext, setChatInitialContext] = useState(null);

  const handleNavigate = (tab, contextPayload = null) => {
    setActiveTab(tab);
    if (tab === 'chat') {
      setChatInitialContext(contextPayload || { forceNewChat: true });
    }
    try {
      localStorage.setItem('insurance_portal_active_tab', tab);
    } catch {}
  };

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || user;
    } catch {
      return user;
    }
  })();

  const isAdmin =
    savedUser?.role === 'COMPANY_ADMIN' || savedUser?.role === 'ADMIN';

  const isStaff =
    isAdmin || savedUser?.role === 'EMPLOYEE';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-slate-950">
      {/* Top Application Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        user={user}
        onLogout={logout}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <HomePage user={user} onNavigateToTab={handleNavigate} />
        )}

        {activeTab === 'insurance' && (
          <InsurancePage user={user} onNavigateToTab={handleNavigate} />
        )}

        {activeTab === 'chat' && (
          <AiChatPage
            initialContext={chatInitialContext}
            onClearInitialContext={() => setChatInitialContext(null)}
          />
        )}

        {isStaff && activeTab === 'documents' && (
          <DocumentsListPage
            onNavigateToUpload={() => handleNavigate('upload')}
            isAdmin={isStaff}
          />
        )}

        {isStaff && activeTab === 'upload' && (
          <UploadDocumentPage
            onViewDocuments={() => handleNavigate('documents')}
            onUploadSuccess={() => {}}
          />
        )}

        {isAdmin && activeTab === 'people' && (
          <PeoplePage
            currentUser={user}
            onNavigateToTab={handleNavigate}
          />
        )}

        {activeTab === 'profile' && (
          <ProfilePage user={user} onNavigateToTab={handleNavigate} />
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        Insurance Portal • Personal & Family Coverage Services
      </footer>
    </div>
  );
}
