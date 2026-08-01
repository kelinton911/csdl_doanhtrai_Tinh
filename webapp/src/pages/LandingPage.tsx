import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';

// Các phân hệ chính của hệ thống
interface ModuleItem {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  icon: IconName;
  tag: string;
  badgeBg: string;
  badgeFg: string;
  accentColor: string;
  features: string[];
}

const MODULES: ModuleItem[] = [
  {
    id: 'gis',
    title: 'GIS 3D & Bản đồ Không gian',
    subtitle: 'GeoVR Digital Twin Command System',
    desc: 'Số hóa 100% bản đồ ranh giới, địa hình, vị trí doanh trại, kho tàng, trạm kiểm soát và điểm quan tâm (POI) trên nền địa không gian 3D chuẩn VN-2000.',
    icon: 'map',
    tag: 'GIS 3D DIGITAL TWIN',
    badgeBg: 'rgba(0, 242, 254, 0.15)',
    badgeFg: '#00f2fe',
    accentColor: '#00f2fe',
    features: [
      'Hiển thị mô hình 3D doanh trại & lớp bản đồ đa tầng',
      'Đo đạc diện tích, khoảng cách & bán kính bảo đảm tác chiến',
      'Định vị tọa độ các kho tàng, trạm kỹ thuật & sở chỉ huy',
      'Tích hợp PostGIS 16 & xử lý dữ liệu thời gian thực',
    ],
  },
  {
    id: 'barracks',
    title: 'Doanh trại & Công trình',
    subtitle: 'Chuẩn hóa danh mục tài sản BQP (CV 2837)',
    desc: 'Quản lý toàn bộ hồ sơ đất quốc phòng, diện tích, công năng sử dụng, năm xây dựng và cấp chất lượng công trình theo tiêu chuẩn Bộ Quốc phòng.',
    icon: 'building',
    tag: 'QUẢN LÝ TÀI SẢN',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeFg: '#3b82f6',
    accentColor: '#2563eb',
    features: [
      'Quản lý 1.272 mã danh mục công trình chuẩn hóa BQP',
      'Phân loại chất lượng: Tốt, Khá, Trung bình, Kém',
      'Theo dõi hồ sơ pháp lý & giấy chứng nhận đất quốc phòng',
      'Cảnh báo công trình xuống cấp & lập kế hoạch bảo trì',
    ],
  },
  {
    id: 'inventory',
    title: 'Quản lý Vật chất & Tồn kho',
    subtitle: 'Kho tàng & Nhập - Xuất - Tồn',
    desc: 'Theo dõi chi tiết số dư tồn kho vật chất ngành doanh trại, vật tư dự trữ sẵn sàng chiến đấu theo từng vị trí kho, lô hàng và hạn sử dụng.',
    icon: 'box',
    tag: 'KHO VẬT CHẤT',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeFg: '#10b981',
    accentColor: '#10b981',
    features: [
      'Quản lý vật chất theo 788 mã tài sản ngành Doanh trại',
      'Cảnh báo vật chất cận hạn dùng & hao hụt tồn kho',
      'Theo dõi biến động kho tổng hợp, kho nhiên liệu & kỹ thuật',
      'Cân đối khả năng bảo đảm hậu cần tức thì',
    ],
  },
  {
    id: 'audit',
    title: 'Kiểm kê Số hóa Di động',
    subtitle: 'Quy trình 4 bước & Quét mã QR',
    desc: 'Số hóa quy trình kiểm kê từ cấp xã, đơn vị cơ sở đến tỉnh. Hỗ trợ thiết bị di động quét mã QR/Barcode kiểm kê di động và phát hiện chênh lệch tự động.',
    icon: 'clipboard',
    tag: 'KIỂM KÊ 4.0',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeFg: '#f59e0b',
    accentColor: '#f59e0b',
    features: [
      'Lập đợt kiểm kê -> Nhập số liệu -> Thẩm định -> Duyệt',
      'Tích hợp camera di động quét mã QR/Barcode tài sản',
      'Tự động so sánh số liệu kiểm kê thực tế và sổ sách',
      'Hỗ trợ chế độ ngoại tuyến PWA cho khu vực mất mạng',
    ],
  },
  {
    id: 'sim',
    title: 'Mô phỏng Diễn tập & Bảo đảm',
    subtitle: 'Tính toán nhu cầu thời chiến',
    desc: 'Xây dựng kịch bản tác chiến, tính toán tự động nhu cầu vật chất hậu cần cho quân số, mô phỏng di chuyển sở chỉ huy và khôi phục công trình.',
    icon: 'target',
    tag: 'TÁC CHIẾN DIỄN TẬP',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeFg: '#ef4444',
    accentColor: '#ef4444',
    features: [
      'Tính toán tự động định mức vật chất theo quân số tác chiến',
      'Mô phỏng tình huống chiến đấu & di chuyển hậu cần',
      'Huy động nguồn lực tiềm lực hậu cần địa phương',
      'Lập phương án khôi phục doanh trại bị hư hỏng',
    ],
  },
  {
    id: 'report',
    title: 'Dashboard Thống kê & Chỉ đạo',
    subtitle: 'Trung tâm điều hành Chỉ huy tỉnh',
    desc: 'Cung cấp bức tranh tổng thể cho Lãnh đạo Bộ CHQS tỉnh, tổng hợp biểu mẫu báo cáo chuẩn Bộ Quốc phòng và trung tâm cảnh báo sự cố 24/7.',
    icon: 'chart',
    tag: 'ĐIỀU HÀNH CHỈ HUY',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeFg: '#8b5cf6',
    accentColor: '#8b5cf6',
    features: [
      'Dashboard trực quan hóa biểu đồ & chỉ số KPIs',
      'Xuất báo cáo tổng hợp theo mẫu quy định BQP',
      'Trung tâm cảnh báo sự cố & hồ sơ chờ duyệt 24/7',
      'Phân quyền truy cập 7 vai trò bảo mật mạng nội bộ',
    ],
  },
];

// 7 Vai trò hệ thống với màu tương phản cao
const SYSTEM_ROLES = [
  { code: 'SYS_ADMIN', label: 'Quản trị hệ thống', desc: 'Quản trị toàn quyền, cấu hình hệ thống & phân quyền người dùng', badgeBg: '#dbeafe', badgeFg: '#1e40af' },
  { code: 'PROVINCIAL_COMMAND', label: 'Chỉ huy tỉnh', desc: 'Lãnh đạo Bộ CHQS tỉnh, theo dõi bức tranh tổng thể & duyệt báo cáo', badgeBg: '#fef3c7', badgeFg: '#92400e' },
  { code: 'BARRACKS_OFFICER', label: 'CB ngành doanh trại', desc: 'Cán bộ quản lý doanh trại, công trình, dự án & theo dõi vật chất', badgeBg: '#dcfce7', badgeFg: '#166534' },
  { code: 'COMMUNE_USER', label: 'CB Ban CHQS xã', desc: 'Cán bộ quản lý dữ liệu Ban CHQS cấp xã / địa bàn cơ sở', badgeBg: '#e0e7ff', badgeFg: '#3730a3' },
  { code: 'REVIEWER', label: 'Kiểm duyệt viên', desc: 'Thẩm định, duyệt biến động doanh trại & phiếu kiểm kê tài sản', badgeBg: '#e0f2fe', badgeFg: '#075985' },
  { code: 'AUDITOR', label: 'CB kiểm tra - thanh tra', desc: 'Kiểm tra, thanh tra chuyên ngành, phát hiện sai sót & chênh lệch', badgeBg: '#fae8ff', badgeFg: '#86198f' },
  { code: 'REPORT_VIEWER', label: 'Xem báo cáo', desc: 'Quyền tra cứu, xem báo cáo tổng hợp & xuất dữ liệu hệ thống', badgeBg: '#f3f4f6', badgeFg: '#374151' },
];

export function LandingPage() {
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  const { profile } = useAuth();
  const [activeModule, setActiveModule] = useState<string>('gis');

  const selectedMod = MODULES.find((m) => m.id === activeModule) || MODULES[0];

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        lineHeight: 1.6,
      }}
    >
      {/* 1. Header Navigation */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(7, 21, 39, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 32px',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                display: 'grid',
                placeItems: 'center',
                color: '#051329',
                fontWeight: 900,
                fontSize: 20,
                boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)',
              }}
            >
              DT
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                BỘ CHỈ HUY QUÂN SỰ TỈNH
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                CSDL VẬT CHẤT DOANH TRẠI 3D GIS
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13.5, fontWeight: 600 }}>
            <a href="#about" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}>Giới thiệu</a>
            <a href="#stats" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}>Số liệu thống kê</a>
            <a href="#gis-section" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}>GIS 3D & Digital Twin</a>
            <a href="#modules" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}>Các phân hệ</a>
            <a href="#workflow" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}>Quy trình số hóa</a>
            <a href="#roles" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}>Phân quyền</a>
          </nav>

          {/* Action Header Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={toggle}
              className="btn btn-ghost btn-sm"
              style={{ color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '6px 10px', borderRadius: 8 }}
              title="Đổi giao diện Sáng/Tối"
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
            </button>

            {profile ? (
              <button
                onClick={() => nav('/dashboard')}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  color: '#051329',
                  fontWeight: 800,
                  fontSize: 13.5,
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)',
                }}
              >
                <Icon name="grid" size={15} /> Bàn làm việc Chỉ huy
              </button>
            ) : (
              <button
                onClick={() => nav('/login')}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  color: '#051329',
                  fontWeight: 800,
                  fontSize: 13.5,
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)',
                }}
              >
                <Icon name="lock" size={15} /> Đăng nhập Hệ thống
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section
        id="about"
        style={{
          position: 'relative',
          background: 'radial-gradient(circle at 50% 20%, #0d2745 0%, #051324 100%)',
          color: '#ffffff',
          padding: '90px 24px 110px',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(0, 242, 254, 0.2)',
        }}
      >
        {/* Cyber Grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(to right, rgba(0, 242, 254, 0.05) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(0, 242, 254, 0.05) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 52, alignItems: 'center' }}>
          {/* Left Hero Column */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(0, 242, 254, 0.12)',
                border: '1px solid rgba(0, 242, 254, 0.4)',
                color: '#00f2fe',
                padding: '6px 16px',
                borderRadius: 30,
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 24,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: '0 0 12px rgba(0, 242, 254, 0.2)',
              }}
            >
              <Icon name="target" size={14} /> Chuyển đổi số Không gian Quốc phòng
            </div>

            <h1 style={{ fontWeight: 900, fontSize: 46, lineHeight: 1.12, letterSpacing: '-0.025em', margin: '0 0 22px', color: '#ffffff' }}>
              HỆ THỐNG CƠ SỞ DỮ LIỆU VẬT CHẤT DOANH TRẠI CẤP TỈNH
            </h1>

            <p style={{ fontSize: 16.5, lineHeight: 1.7, color: '#94a3b8', margin: '0 0 36px', maxWidth: '54ch' }}>
              Nền tảng số hóa không gian <b>GIS 3D & Digital Twin</b> kết hợp quản lý tập trung doanh trại, công trình, vật chất hậu cần và mô phỏng bảo đảm phục vụ chỉ huy sẵn sàng chiến đấu.
            </p>

            {/* Hero Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 44 }}>
              <button
                onClick={() => nav('/login')}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  color: '#051329',
                  padding: '14px 28px',
                  fontSize: 15,
                  borderRadius: 10,
                  fontWeight: 800,
                  border: 'none',
                  boxShadow: '0 6px 25px rgba(0, 242, 254, 0.4)',
                  cursor: 'pointer',
                }}
              >
                <Icon name="lock" size={18} /> Đăng nhập Xác thực Ngay
              </button>

              <a
                href="#gis-section"
                className="btn"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  padding: '14px 24px',
                  fontSize: 14.5,
                  borderRadius: 10,
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon name="map" size={18} /> Khám phá Bản đồ GIS 3D
              </a>
            </div>

            {/* Badges Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: 24 }}>
              <div>
                <div style={{ color: '#00f2fe', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em' }}>HẠ TẦNG NỘI BỘ</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Bảo mật mạng quân sự</div>
              </div>
              <div>
                <div style={{ color: '#38ef7d', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em' }}>CHUẨN BQP</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>CV 2837/DT-QLDT</div>
              </div>
              <div>
                <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em' }}>KHÔNG GIAN 3D</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>GeoVR PostGIS 16</div>
              </div>
            </div>
          </div>

          {/* Right Hero Graphic */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                border: '2px solid rgba(0, 242, 254, 0.5)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(0, 242, 254, 0.25)',
                background: '#040d18',
                position: 'relative',
              }}
            >
              <img
                src="/hero-gis.png"
                alt="Hệ thống CSDL Vật chất Doanh trại GIS 3D Digital Twin"
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 18,
                  left: 18,
                  right: 18,
                  background: 'rgba(5, 19, 37, 0.9)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(0, 242, 254, 0.4)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#38ef7d', boxShadow: '0 0 10px #38ef7d' }} />
                  <span style={{ fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>TRUNG TÂM ĐIỀU HÀNH 3D GIS ACTIVE</span>
                </div>
                <span style={{ color: '#00f2fe', fontWeight: 700 }}>VN-2000 / WGS-84</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Statistical Highlights & Metrics */}
      <section id="stats" style={{ padding: '80px 24px', background: 'var(--surface-1)', borderBottom: '1px solid var(--color-neutral-300)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 52px' }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Báo cáo Thống kê Đã Số Hóa
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 12px' }}>
              CHỈ SỐ TIỀM LỰC & BẢO ĐẢM HẬU CẦN
            </h2>
            <p style={{ color: 'var(--color-neutral-600)', fontSize: 15.5, margin: 0, lineHeight: 1.6 }}>
              Số liệu chuẩn hóa thời gian thực phục vụ công tác quản lý, duy trì sẵn sàng chiến đấu và báo cáo chỉ đạo Bộ CHQS tỉnh.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 24 }}>
            {[
              { num: '30+', label: 'DOANH TRẠI CẤP TỈNH', desc: 'Quản lý tập trung toàn bộ địa bàn tỉnh', icon: 'building' as IconName, color: '#00f2fe', bg: '#082f49' },
              { num: '180+', label: 'CÔNG TRÌNH XÂY DỰNG', desc: 'Chuẩn hóa danh mục tài sản theo CV 2837', icon: 'grid' as IconName, color: '#3b82f6', bg: '#1e3a8a' },
              { num: '1.200+', label: 'HẠNG MỤC VẬT CHẤT', desc: 'Nhập xuất tồn kho & hạn sử dụng', icon: 'box' as IconName, color: '#10b981', bg: '#064e3b' },
              { num: '100%', label: 'SỐ HÓA GIS 3D', desc: 'Tọa độ PostGIS & mô hình Digital Twin', icon: 'map' as IconName, color: '#f59e0b', bg: '#78350f' },
              { num: '24/7', label: 'BẢO ĐẢM HẬU CẦN', desc: 'Sẵn sàng ứng phó mọi tình huống tác chiến', icon: 'shield' as IconName, color: '#ef4444', bg: '#7f1d1d' },
            ].map((st, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-neutral-300)',
                  borderRadius: 16,
                  padding: 26,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 40, fontWeight: 900, fontFamily: 'var(--font-heading)', color: st.color, letterSpacing: '-0.02em' }}>
                    {st.num}
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: st.bg, color: st.color, display: 'grid', placeItems: 'center' }}>
                    <Icon name={st.icon} size={22} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--color-text)' }}>{st.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)', lineHeight: 1.5 }}>{st.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. GIS 3D & Digital Twin Technology Spotlight */}
      <section id="gis-section" style={{ padding: '90px 24px', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(0, 242, 254, 0.12)', color: '#00c2cb', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Công nghệ GeoVR Digital Twin
              </div>
              <h2 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, marginBottom: 22, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                MÔ PHỎNG KHÔNG GIAN BẢN ĐỒ GIS 3D & DIGITAL TWIN
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-neutral-700)', marginBottom: 28 }}>
                Tích hợp công nghệ bản đồ số GIS PostGIS 16 và mô hình số hóa không gian 3D, cho phép trực quan hóa vị trí doanh trại, phân vùng hạ tầng công trình, đo đạc bán kính bảo đảm và tra cứu thông tin địa chính chính xác.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
                {[
                  { title: 'Tọa độ chuẩn VN-2000 / WGS-84', desc: 'Định vị chính xác mốc ranh giới đất quốc phòng & vị trí công trình.' },
                  { title: 'Hiển thị Lớp dữ liệu Đa tầng', desc: 'Bật tắt linh hoạt lớp Doanh trại, Kho tàng, POI, Trạm kiểm soát & Địa bàn.' },
                  { title: 'Truy xuất Hồ sơ Không gian 1-Click', desc: 'Nhấp trực tiếp trên bản đồ 3D để xem ngay diện tích, quân số & chất lượng công trình.' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Icon name="check" size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => nav('/login')} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14.5, fontWeight: 700, borderRadius: 10 }}>
                <Icon name="map" size={18} /> Xem Bản đồ Tương tác 3D
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <div
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '1px solid var(--color-neutral-300)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
                  background: 'var(--surface-1)',
                }}
              >
                <img
                  src="/digital-twin.png"
                  alt="Mô hình 3D Digital Twin Doanh trại Quân sự"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. System Modules Interactive Explorer */}
      <section id="modules" style={{ padding: '90px 24px', background: 'var(--surface-1)', borderTop: '1px solid var(--color-neutral-300)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 52px' }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Kiến trúc Phân hệ Mở
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
              CÁC PHÂN HỆ CHỨC NĂNG HỆ THỐNG
            </h2>
            <p style={{ color: 'var(--color-neutral-600)', fontSize: 15.5, margin: 0, lineHeight: 1.6 }}>
              Hệ thống được thiết kế theo kiến trúc phân hệ mở, kết nối dữ liệu liên thông từ Ban CHQS cấp xã đến Bộ CHQS tỉnh.
            </p>
          </div>

          {/* Module Selection Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 24, marginBottom: 44 }}>
            {MODULES.map((mod) => {
              const isSelected = mod.id === activeModule;
              return (
                <div
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  style={{
                    background: isSelected ? 'var(--color-bg)' : 'var(--color-bg)',
                    border: isSelected ? `2px solid ${mod.accentColor}` : '1px solid var(--color-neutral-300)',
                    borderRadius: 16,
                    padding: 26,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 18,
                    boxShadow: isSelected ? `0 10px 30px rgba(0, 0, 0, 0.1)` : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: mod.badgeBg, color: mod.badgeFg, display: 'grid', placeItems: 'center' }}>
                        <Icon name={mod.icon} size={22} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: mod.badgeBg, color: mod.badgeFg, letterSpacing: '0.04em' }}>
                        {mod.tag}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: 'var(--color-text)' }}>{mod.title}</h3>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)', marginBottom: 12 }}>{mod.subtitle}</div>
                    <p style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', lineHeight: 1.6, margin: 0 }}>{mod.desc}</p>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--color-neutral-300)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: mod.badgeFg }}>
                    <span>Xem chi tiết phân hệ</span>
                    <Icon name="chevron" size={15} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Module Detail Banner */}
          <div
            style={{
              background: 'var(--color-bg)',
              border: `2px solid ${selectedMod.accentColor}`,
              borderRadius: 18,
              padding: 36,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 44,
              alignItems: 'center',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div>
              <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 12px', borderRadius: 6, background: selectedMod.badgeBg, color: selectedMod.badgeFg, letterSpacing: '0.06em' }}>
                ĐANG CHỌN: {selectedMod.tag}
              </span>
              <h3 style={{ fontSize: 28, fontWeight: 900, marginTop: 14, marginBottom: 12, color: 'var(--color-text)' }}>{selectedMod.title}</h3>
              <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', lineHeight: 1.65, marginBottom: 24 }}>{selectedMod.desc}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedMod.features.map((feat, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    <Icon name="check" size={18} className="text-teal" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--color-neutral-300)', borderRadius: 14, padding: 28 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-neutral-600)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                ⚡ Thao tác mẫu trong Phân hệ
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => nav('/login')} className="btn btn-primary" style={{ justifyContent: 'space-between', padding: '12px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                  <span>Truy cập phân hệ {selectedMod.title}</span>
                  <Icon name="chevron" size={16} />
                </button>
                <button onClick={() => nav('/login')} className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '12px 18px', border: '1px solid var(--color-neutral-400)', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                  <span>Xem báo cáo mẫu của phân hệ</span>
                  <Icon name="file" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Digital Transformation Workflow (4 Bước) */}
      <section id="workflow" style={{ padding: '90px 24px', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 52px' }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Quy trình Chuẩn hóa BQP
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              4 BƯỚC CHUYỂN ĐỔI SỐ DOANH TRẠI
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {[
              { step: '01', title: 'Khảo sát & Nạp dữ liệu GIS', desc: 'Thu thập ranh giới đất quốc phòng, vị trí doanh trại & tọa độ địa không gian VN-2000.' },
              { step: '02', title: 'Chuẩn hóa Danh mục Tài sản', desc: 'Áp dụng bảng 1.272 mã tài sản ngành Doanh trại theo CV 2837/DT-QLDT.' },
              { step: '03', title: 'Kiểm kê Số hóa Di động', desc: 'Thu thập số liệu kiểm kê thực tế qua camera mã QR, tự động tính chênh lệch sổ sách.' },
              { step: '04', title: 'Điều hành Chỉ đạo Chỉ huy', desc: 'Dự báo khả năng bảo đảm hậu cần, mô phỏng kịch bản tác chiến & xuất báo cáo BQP.' },
            ].map((wf, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--color-neutral-300)',
                  borderRadius: 16,
                  padding: 28,
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 36, fontWeight: 900, color: '#00f2fe', fontFamily: 'var(--font-heading)', marginBottom: 14 }}>
                  {wf.step}
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, color: 'var(--color-text)' }}>{wf.title}</h4>
                <p style={{ fontSize: 13.5, color: 'var(--color-neutral-600)', lineHeight: 1.6, margin: 0 }}>{wf.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. System Roles & Access Control */}
      <section id="roles" style={{ padding: '90px 24px', background: 'var(--surface-1)', borderTop: '1px solid var(--color-neutral-300)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Bảo mật Mạng Nội bộ
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
              PHÂN QUYỀN 7 VAI TRÒ NGHIỆP VỤ
            </h2>
            <p style={{ color: 'var(--color-neutral-600)', fontSize: 15.5, margin: 0, lineHeight: 1.6 }}>
              Đảm bảo an toàn thông tin quân sự, phân định rõ phạm vi trách nhiệm từ chỉ huy tỉnh đến cán bộ địa bàn.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 20 }}>
            {SYSTEM_ROLES.map((r) => (
              <div
                key={r.code}
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-neutral-300)',
                  borderRadius: 14,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: r.badgeBg, color: r.badgeFg, letterSpacing: '0.04em' }}>
                    {r.code}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Call To Action Footer Banner */}
      <section style={{ background: '#051324', color: '#ffffff', padding: '70px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 24, color: '#051329', boxShadow: '0 0 25px rgba(0, 242, 254, 0.4)' }}>
            DT
          </div>

          <h2 style={{ fontSize: 36, fontWeight: 900, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
            SẴN SÀNG CHUYỂN ĐỔI SỐ NGÀNH DOANH TRẠI QUÂN SỰ
          </h2>
          <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: '60ch', margin: 0, lineHeight: 1.65 }}>
            Hệ thống CSDL Vật chất Doanh trại cấp tỉnh — Phục vụ công tác chỉ đạo, duy trì khả năng sẵn sàng chiến đấu và bảo đảm hậu cần.
          </p>

          <button
            onClick={() => nav('/login')}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#051329',
              padding: '14px 32px',
              fontSize: 15.5,
              fontWeight: 800,
              borderRadius: 10,
              border: 'none',
              boxShadow: '0 6px 25px rgba(0, 242, 254, 0.4)',
              cursor: 'pointer',
            }}
          >
            <Icon name="lock" size={18} /> Đăng nhập Xác thực Ngay
          </button>
        </div>
      </section>

      {/* 9. Footer */}
      <footer style={{ background: '#030a14', color: '#64748b', padding: '28px 32px', fontSize: 12.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 800 }}>Bộ Chỉ huy Quân sự tỉnh — Cơ quan Hậu cần - Kỹ thuật</div>
            <div>Hệ thống Cơ sở dữ liệu Vật chất Doanh trại cấp tỉnh (v1.0.0-internal)</div>
          </div>
          <div style={{ display: 'flex', gap: 24, color: '#94a3b8' }}>
            <span>Mạng nội bộ bảo mật</span>
            <span>Chuẩn BQP CV 2837</span>
            <span>PostGIS 16 3D GIS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
