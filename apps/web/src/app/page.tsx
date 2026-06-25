"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import BackgroundShader from "@/components/BackgroundShader";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [displayName, setDisplayName] = useState("");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

    useEffect(() => {
    if (user) {
      const saved = localStorage.getItem('snakevnr_display_name');
      if (saved) {
                // eslint-disable-next-line
        setDisplayName(saved);
      } else {
        const defaultName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Player";
                // eslint-disable-next-line
        setDisplayName(defaultName);
        localStorage.setItem('snakevnr_display_name', defaultName);
      }
    }
  }, [user]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
    localStorage.setItem('snakevnr_display_name', e.target.value);
  };

  const handleSignIn = async () => {
    if (!email || !password) return setMsg("Vui lòng nhập email và mật khẩu");
    setMsg("Đang đăng nhập...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else setMsg("");
  };

  const handleSignUp = async () => {
    if (!email || !password) return setMsg("Vui lòng nhập email và mật khẩu");
    setMsg("Đang đăng ký...");
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Đăng ký thành công! Đang đăng nhập...");
    }
  };

  const handleMockLogin = () => {
    setUser({
      id: "guest-" + Math.floor(Math.random() * 10000),
      email: "khach@snakevnr.local",
      user_metadata: { full_name: "Người chơi Khách" }
    } as User);
    setMsg("");
  };

  const handleLogout = async () => {
    if (user?.email?.includes("snakevnr.local")) {
      setUser(null);
    } else {
      await supabase.auth.signOut();
    }
  };

  const handleJoin = () => {
    if (roomId.trim()) {
      router.push(`/play/${roomId}`);
    }
  };

  const handleCreate = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/play/${newRoomId}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)' }}>
        <div className="headline-md" style={{ color: 'var(--primary-container)' }}>Đang tải...</div>
      </div>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'Player')}&background=2ae500&color=053900&bold=true`;

  return (
    <>
      <BackgroundShader />
      
      {!user ? (
        <main style={{ 
          position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", 
          flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--spacing-md)" 
        }}>
          <h1 className="display-lg" style={{ marginBottom: "var(--spacing-lg)", color: "var(--primary)", textShadow: "var(--glow-primary)", textAlign: "center" }}>
            SNAKE ARENA
          </h1>
          
          <div className="glass-panel" style={{ 
            display: "flex", flexDirection: "column", gap: "var(--spacing-md)", 
            padding: "var(--spacing-lg)", maxWidth: "400px", width: "100%", alignItems: "center" 
          }}>
            <h2 className="headline-md" style={{ color: "var(--primary-container)" }}>Authentication</h2>
            
            <input type="email" className="input-glass" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="input-glass" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            
            <div style={{ display: "flex", gap: "var(--spacing-sm)", width: "100%", marginTop: "var(--spacing-sm)" }}>
              <button className="btn-secondary" onClick={handleSignIn} style={{ flex: 1 }}>LOGIN</button>
              <button className="btn-primary" onClick={handleSignUp} style={{ flex: 1, padding: '12px 24px', fontSize: '16px' }}>SIGN UP</button>
            </div>
            
            <div className="label-caps" style={{ margin: "var(--spacing-sm) 0", color: "var(--on-surface-variant)" }}>- OR -</div>
            
            <button className="btn-secondary" onClick={handleMockLogin} style={{ width: "100%", borderStyle: 'dashed' }}>GUEST LOGIN</button>
            {msg && <p style={{ color: "var(--error)", fontSize: "14px", marginTop: "8px" }}>{msg}</p>}
          </div>
        </main>
      ) : (
        <div style={{ display: "flex", width: "100%", minHeight: "100vh", position: "relative", zIndex: 10 }}>
          
          {/* TopAppBar */}
          <nav style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: 'var(--spacing-xs) var(--spacing-md)', width: '100%', zIndex: 50, 
            background: 'rgba(19, 19, 21, 0.6)', backdropFilter: 'blur(24px)', 
            position: 'fixed', top: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
            height: '80px', boxShadow: '0 0 20px rgba(42,229,0,0.1)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span className="display-lg" style={{ color: 'var(--primary)', letterSpacing: '-0.02em', fontSize: '32px' }}>SNAKE ARENA</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', background: 'rgba(32, 31, 33, 0.5)', borderRadius: '9999px', padding: '4px 12px' }}>
                <img src={avatarUrl} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(239, 255, 227, 0.3)', objectFit: 'cover' }} alt="Avatar" />
                <span className="headline-md" style={{ color: 'var(--primary)', fontSize: '14px' }}>{displayName || 'Player'}</span>
              </div>
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', color: 'var(--on-surface-variant)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
                <span className="label-caps" style={{ display: 'none' }}>Đăng xuất</span> {/* Can hide on mobile using CSS if needed, for now keep inline */}
                <span className="label-caps">Đăng xuất</span>
              </button>
            </div>
          </nav>

          {/* SideNavBar (Desktop Only) */}
          <aside style={{ 
            display: 'flex', flexDirection: 'column', padding: 'var(--spacing-md)', 
            gap: 'var(--spacing-sm)', background: 'rgba(32, 31, 33, 0.4)', backdropFilter: 'blur(24px)', 
            position: 'fixed', left: 0, top: 0, height: '100%', width: '256px', 
            borderRight: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
            zIndex: 40, paddingTop: '112px' 
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--spacing-lg)', paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid rgba(60, 75, 53, 0.3)' }}>
              <img src={avatarUrl} style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--primary-container)', boxShadow: 'var(--glow-primary)', marginBottom: 'var(--spacing-sm)', objectFit: 'cover' }} alt="Profile" />
              <input 
                type="text" 
                value={displayName} 
                onChange={handleNameChange} 
                className="input-glass" 
                style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600, color: 'var(--primary)', borderBottomColor: 'var(--primary)', padding: '4px 8px' }} 
                title="Sửa tên của bạn"
              />
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1 }}>
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', background: 'var(--primary-container)', color: 'var(--on-primary-container)', borderRadius: 'var(--radius-default)', textDecoration: 'none' }}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sports_esports</span>
                <span className="headline-md" style={{ fontSize: '18px' }}>Lobby</span>
              </a>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main style={{ 
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', 
            paddingTop: '80px', paddingLeft: '256px', paddingRight: 'var(--spacing-md)', 
            paddingBottom: 'var(--spacing-md)', overflowY: 'auto', width: '100%' 
          }}>
            <div style={{ 
              display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', 
              width: '100%', maxWidth: '1200px', margin: '0 auto', paddingBottom: 'var(--spacing-lg)' 
            }}>
              
              {/* Join Section */}
              <div className="glass-panel" style={{ 
                flex: '1 1 400px', background: 'rgba(42, 42, 44, 0.4)', borderRadius: 'var(--radius-xl)', 
                padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-lg)', position: 'relative' 
              }}>
                <div style={{ textAlign: 'center', width: '100%', maxWidth: '300px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '60px', color: 'var(--primary)', marginBottom: 'var(--spacing-md)', fontVariationSettings: "'FILL' 0" }}>login</span>
                  <h2 className="display-lg" style={{ color: 'var(--primary)', marginBottom: 'var(--spacing-sm)', letterSpacing: '-0.02em' }}>THAM GIA</h2>
                  <p className="body-lg" style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>Nhập mã phòng để tham gia trận đấu</p>
                  
                  <div style={{ width: '100%', position: 'relative', marginBottom: 'var(--spacing-lg)' }}>
                    <input 
                      type="text" 
                      maxLength={12} 
                      placeholder="ABCD12" 
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      style={{ 
                        width: '100%', background: 'rgba(19, 19, 21, 0.8)', border: 'none', 
                        borderBottom: '2px solid var(--secondary)', color: 'var(--primary)', 
                        fontFamily: 'var(--font-jetbrains-mono)', fontSize: '36px', textAlign: 'center', 
                        padding: 'var(--spacing-md) var(--spacing-sm)', outline: 'none', 
                        textTransform: 'uppercase', letterSpacing: '0.2em' 
                      }} 
                    />
                  </div>
                  
                  <button onClick={handleJoin} style={{ 
                    width: '100%', padding: 'var(--spacing-md)', background: 'var(--surface-variant)', 
                    color: 'var(--primary)', border: '1px solid var(--secondary)', 
                    fontFamily: 'var(--font-outfit)', fontSize: '24px', fontWeight: 600, 
                    borderRadius: 'var(--radius-default)', cursor: 'pointer', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' 
                  }}>
                    <span>Vào Phòng</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Host Section */}
              <div className="glass-panel" style={{ 
                flex: '1 1 400px', background: 'rgba(42, 42, 44, 0.4)', borderRadius: 'var(--radius-xl)', 
                padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-lg)', position: 'relative' 
              }}>
                <div style={{ textAlign: 'center', width: '100%', maxWidth: '300px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '60px', color: 'var(--secondary)', marginBottom: 'var(--spacing-md)', fontVariationSettings: "'FILL' 0" }}>add_circle</span>
                  <h2 className="display-lg" style={{ color: 'var(--secondary)', marginBottom: 'var(--spacing-sm)', letterSpacing: '-0.02em' }}>TẠO PHÒNG</h2>
                  <p className="body-lg" style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>Bắt đầu một đấu trường mới và mời bạn bè</p>
                  
                  <div style={{ 
                    width: '100%', height: '128px', background: 'rgba(19, 19, 21, 0.5)', 
                    borderRadius: 'var(--radius-default)', border: '1px solid rgba(60, 75, 53, 0.3)', 
                    marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', position: 'relative', overflow: 'hidden' 
                  }}>
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: 'radial-gradient(#a2e7ff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--secondary)', fontVariationSettings: "'FILL' 1", animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>wifi_tethering</span>
                  </div>
                  
                  <button className="btn-primary" onClick={handleCreate} style={{ 
                    width: '100%', padding: 'var(--spacing-md)', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' 
                  }}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    <span>Tạo Phòng Mới</span>
                  </button>
                </div>
              </div>
              
            </div>
          </main>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        @media (max-width: 768px) {
          aside { display: none !important; }
          main { padding-left: var(--spacing-md) !important; }
        }
      `}</style>
    </>
  );
}
