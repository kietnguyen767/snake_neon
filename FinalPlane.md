# 🎮 RẮN SĂN MỒI TRI THỨC — Game Design Document & Kiến trúc kỹ thuật (Bản chốt v4 — vá lỗi kỹ thuật ẩn trong v3)

> So với v3: vá 2 lỗi thực thi sai trong chính các giải pháp mới của v3 (cơ chế Tăng tốc mô tả sai cách Colyseus chạy tick — sửa bằng accumulator + sub-stepping; đồng bộ đồng hồ đếm ngược bằng offset đo 1 lần có rủi ro lệch khi ping đổi giữa trận — sửa bằng nguyên tắc "server luôn thắng"), và bổ sung 1 lưới an toàn cho batch write cuối trận (log file cục bộ) kèm điều kiện cần xác minh thật trên hạ tầng hosting trước khi tin tưởng hoàn toàn vào nó. Mọi mục đều là quyết định cuối, có số liệu/pseudocode kèm theo.

---

## PHẦN A — GAME DESIGN

### A1. Thông tin chung

| Thuộc tính | Giá trị |
|---|---|
| Số người chơi / phòng | 4–20 |
| Thời gian trận | 10 phút |
| Chế độ | Cá nhân (mỗi người 1 rắn) |
| Nền tảng | Web (desktop trước, mobile sau) |

### A2. Bản đồ và mồi

- Bản đồ luôn duy trì **3–5 mồi** sống cùng lúc.
- Mồi bị ăn → biến mất → 1 mồi mới spawn ngẫu nhiên (tránh spawn trùng vị trí rắn/mồi khác/tường).

| Loại mồi | Điểm | Tỉ lệ xuất hiện gợi ý |
|---|---|---|
| Mồi thường | 10 | 70% |
| Mồi vàng | 20 | 22% |
| Mồi kim cương | 30 | 8% |

*Tỉ lệ xuất hiện chưa có trong bản gốc — mình bổ sung để server có quy tắc spawn rõ ràng, tránh tình trạng mồi kim cương ra quá dày hoặc quá hiếm một cách tùy tiện.*

### A3. Luồng chơi 1 lượt ăn mồi

1. Rắn chạm mồi → mồi biến mất ngay trên client (phản hồi tức thì) → server xác nhận.
2. Câu hỏi hiện ra, **đếm ngược 10 giây**.
3. Trả lời đúng trong thời gian → cộng điểm theo loại mồi.
4. Trả lời sai / hết giờ → không cộng điểm, ván tiếp tục bình thường.

**CHỐT:** Khi câu hỏi xuất hiện, server đặt rắn vào trạng thái `ANSWERING`:
- Rắn **dừng di chuyển hoàn toàn** (server không xử lý input di chuyển của player này trong trạng thái này).
- Rắn **miễn va chạm** (không bị tính là vật cản với rắn khác, không tự đâm tường vì đã dừng).
- Trạng thái này áp dụng kể cả khi trả lời đúng/sai/hết giờ — chỉ thoát `ANSWERING` khi server nhận được lựa chọn HOẶC hết 10 giây, sau đó trả input lại ngay (độ trễ chuyển trạng thái = 0, không có "thời gian chờ phụ" sau khi trả lời).
- Lý do chốt cứng theo hướng này thay vì "chạy theo hướng cuối": đứng yên loại bỏ hoàn toàn rủi ro rắn tự đâm tường trong lúc người chơi không kiểm soát — không cần thêm logic xử lý edge case nào khác.
- **BỔ SUNG — render khi đứng yên:** rắn ở trạng thái `ANSWERING` không được hiển thị như rắn bình thường (sẽ trông "giả" nếu rắn khác lướt xuyên qua thân mà không có phản hồi gì). CHỐT: rắn `ANSWERING` chuyển sang dạng **ghost/bán trong suốt** (giảm opacity, ví dụ 40%) trong toàn bộ thời gian đứng yên. Về va chạm: nếu rắn khác đâm vào **đầu** của rắn đang trả lời → vẫn tính là va chạm bình thường (rắn đối phương dừng 2 giây theo luật A6, rắn đang trả lời không bị ảnh hưởng vì đang miễn va chạm); nếu đâm vào **thân** → cho lướt qua tự nhiên, không tính va chạm. Quy tắc này giữ cảm giác "rắn vẫn còn tồn tại ở đó" (qua hình ảnh ghost + đầu vẫn cản đường) mà không tạo cảm giác khó chịu vì thân dài chiếm hết lối đi trong lúc người chơi không thể phản ứng.

### A4. Hệ thống câu hỏi

- 8 chủ đề: Kiến thức chung, Khoa học, Lịch sử, Địa lý, Văn hóa, Thể thao, Công nghệ, Câu đố vui.
- Trắc nghiệm 4 đáp án, 1 đáp án đúng, 10 giây/câu.
- **CHỐT:** Không lặp câu hỏi trong cùng 1 trận. Cơ chế: mỗi `GameRoom` giữ một `Set<questionId>` đã dùng trong trận; khi chọn câu hỏi mới, query loại trừ các id trong set đó (`WHERE id NOT IN (...)`, hoặc nếu danh sách dài thì load toàn bộ id ngân hàng vào memory khi tạo room rồi lọc tại server — nhanh hơn round-trip DB liên tục).
- **CHỐT:** Độ khó gắn trực tiếp với loại mồi để tăng chiều sâu chiến thuật: mồi thường → câu `difficulty=1`, mồi vàng → `difficulty=2`, mồi kim cương → `difficulty=3`. Điều này khiến phần thưởng cao đi kèm rủi ro cao hơn (câu khó hơn), hợp lý hơn so với để ngẫu nhiên.
- **CHỐT:** Ngân hàng câu hỏi tối thiểu **480 câu** cho bản MVP — chia đều: 8 chủ đề × 3 độ khó × 20 câu = 480. Số này đủ cho một trận 10 phút với phòng 20 người chơi liên tục (giả định trung bình mỗi người ăn được 1 mồi/45–60 giây → 20 người × ~12 lượt ăn/trận ≈ 240 lượt hỏi/trận, vẫn còn dư câu để tránh lặp ở trận kế tiếp khi ngân hàng được "refill" theo phiên mới mỗi trận).

### A5. Vật phẩm đặc biệt

| Vật phẩm | Hiệu ứng |
|---|---|
| ⚡ Tăng tốc | Tăng tốc di chuyển 5 giây |
| 🛡 Khiên | Miễn va chạm 1 lần |
| 🎁 Hộp bí ẩn | Random: +10đ / +20đ / Tăng tốc / Khiên |

**CHỐT (đã xử lý vấn đề "Grid Tunneling"):** Có một rủi ro kỹ thuật thật với vật phẩm ⚡ Tăng tốc trên lưới: nếu tăng tốc đơn giản bằng cách tăng *tốc độ pixel* di chuyển mà không đổi cách tính va chạm theo tick, rắn có thể di chuyển quá xa trong 1 tick và "nhảy qua" (tunnel) một ô tường/mồi/rắn khác mà không bị server phát hiện va chạm ở ô đó.

Một hướng giải quyết là bỏ hẳn vật phẩm Tăng tốc và thay bằng "Rút ngắn thân đối thủ" hoặc "Đóng băng đối thủ 2 giây" — các hiệu ứng không đổi quy luật di chuyển nên tránh được vấn đề tận gốc. Tuy nhiên, **mình chọn giữ lại Tăng tốc** vì đây là vật phẩm trực quan nhất với người chơi phổ thông (học sinh/sinh viên) và là kỳ vọng mặc định của thể loại game rắn — bỏ đi sẽ làm giảm tính "arcade" mà thiết kế đang nhắm tới.

**SỬA LẠI cách implement (bản trước mô tả sai cơ chế Colyseus — cần đính chính):** Câu chốt trước nói "server tick nhanh hơn cho riêng input của rắn đó" — điều này **không đúng** với cách Colyseus hoạt động: 1 `Room` chỉ chạy **một vòng `setInterval` duy nhất cho toàn phòng** (ví dụ `this.setInterval(update, 50)`), không thể tạo tick rate riêng cho từng player. Cách đúng để tăng tốc an toàn trên 1 vòng tick chung:

- Mỗi player giữ 1 biến `moveAccumulator` (số thực, cộng dồn mỗi tick): tốc độ bình thường ví dụ `speed = 0.5` (ô/tick, tức 10 ô/giây ở 20Hz), tăng tốc thì `speed = 1.5` (30 ô/giây).
- Mỗi tick: `player.moveAccumulator += player.speed`.
- **Bắt buộc dùng `while` (không dùng `if`)** để rút hết phần tích lũy ≥ 1.0, và **kiểm tra va chạm ngay sau mỗi lần di chuyển 1 ô** — đây là điểm mấu chốt: nếu tăng tốc khiến accumulator vượt 2.0 trong 1 tick (ví dụ speed=1.5 cộng dồn từ dư cũ), vòng lặp sẽ chạy 2 lần di chuyển trong cùng 1 tick logic — nếu không check va chạm giữa 2 lần đó, tunneling vẫn xảy ra dù tốc độ "trông có vẻ" đã chia nhỏ đúng.

```ts
// Chạy trong mỗi tick (50ms), cho từng player:
player.moveAccumulator += player.speed;
while (player.moveAccumulator >= 1.0) {
  moveOneCell(player);        // di chuyển đúng 1 ô liền kề
  checkCollision(player);     // kiểm tra va chạm/ăn mồi NGAY sau ô vừa đi, không đợi hết vòng lặp
  if (player.isDead || player.hitWall) break; // dừng ngay nếu có sự cố, không tiếp tục rút thêm ô
  player.moveAccumulator -= 1.0;
}
```
Miễn giữ đúng cấu trúc `while` + check va chạm sau từng ô (sub-stepping), vật phẩm Tăng tốc an toàn ở bất kỳ giá trị `speed` nào, không bị tunneling dù chạy trên 1 vòng tick chung của toàn phòng.
- Vật phẩm "Rút ngắn thân đối thủ" hoặc "Đóng băng đối thủ" vẫn là ý tưởng hay — đề xuất thêm vào **sau MVP** như vật phẩm bổ sung, không cần thay thế Tăng tốc.

**Cần chốt thêm:** Vật phẩm có cần trả lời câu hỏi mới nhận không, hay nhận trực tiếp khi ăn? Đề xuất: **vật phẩm thường không gắn câu hỏi** — giữ cơ chế "ăn mồi tri thức → trả lời câu hỏi" tách biệt với "ăn vật phẩm → nhận ngay", để không làm loãng nhịp game (nếu cái gì ăn vào cũng phải trả lời câu hỏi, người chơi sẽ mệt vì hỏi liên tục).

### A6. Va chạm

| Tình huống | Hậu quả |
|---|---|
| Đâm tường | Quay về điểm xuất phát, không mất điểm |
| Đâm rắn khác | Dừng 2 giây, không mất điểm |

Cơ chế nhẹ tay, đúng tinh thần "không loại người chơi sớm" — hợp lý với đối tượng học sinh/sinh viên, ưu tiên trải nghiệm vui vẻ hơn là cạnh tranh khắc nghiệt.

### A7. Kết thúc & xếp hạng

Sau 10 phút, xếp hạng theo thứ tự ưu tiên:
1. Tổng điểm
2. Số câu trả lời đúng
3. Số mồi đã ăn

*Đủ rõ, không cần sửa.*

---

## PHẦN B — ĐÁNH GIÁ GAME DESIGN

**Điểm mạnh (đúng như bản gốc nêu):**
- Luật đơn giản, không có cơ chế trừ điểm/loại người chơi → phù hợp môi trường giáo dục, sự kiện tập thể, không tạo cảm giác bị đào thải.
- Mồi giá trị cao tạo cơ hội lội ngược dòng → giữ động lực chơi đến cuối trận.
- Kết hợp phản xạ (điều khiển rắn) + kiến thức (trả lời câu hỏi) → khác biệt so với rắn săn mồi truyền thống.

**Rủi ro và giải pháp đã chốt:**

**1. Tranh mồi khi phòng đông.**
CHỐT công thức scale số mồi theo số người chơi đang hoạt động trong phòng:

```
food_count = clamp(round(active_players / 3), 3, 10)
```

| Số người chơi | Số mồi |
|---|---|
| 4–8 | 3 |
| 9–11 | 3–4 |
| 12–17 | 4–6 |
| 18–20 | 6–7 |

Server tính lại `food_count` mỗi khi có người vào/rời phòng (không tính lại theo tick, chỉ theo sự kiện join/leave). Nếu mồi hiện tại ít hơn `food_count` mới → spawn thêm ngay; nếu nhiều hơn → để tự giảm dần theo cơ chế ăn mồi tự nhiên (không xóa mồi đang tồn tại để tránh giật hình).

**2. Lợi thế "tạm dừng an toàn" khi trả lời câu hỏi.**
CHỐT: đây là đánh đổi có chủ đích, không sửa — vì đối trọng của nó là rủi ro mất 10 giây không di chuyển (không thể ăn mồi khác, có thể bị đối thủ ăn hết mồi gần đó). Không cần thêm cơ chế bù trừ nào ở MVP. Theo dõi qua dữ liệu thật (tỉ lệ thắng có tương quan với số lần ăn mồi/phút) sau khi có vài trận test; chỉ điều chỉnh nếu dữ liệu cho thấy mất cân bằng rõ rệt.

**3. Gian lận câu trả lời.**
CHỐT giao thức message hai chiều — đây là rule bắt buộc, không có ngoại lệ:

```ts
// Server → Client (khi ăn mồi)
type QuestionPayload = {
  questionId: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  // KHÔNG có trường correctAnswer ở đây — tuyệt đối không gửi xuống client
  deadlineServerTs: number; // chỉ dùng để client khởi tạo animation đếm ngược cho mượt mắt,
                            // KHÔNG dùng để client tự quyết định đóng UI — xem cơ chế đồng hồ đã sửa ở Phần A5
};
```

// Client → Server (khi trả lời)
type AnswerPayload = {
  questionId: string;
  choice: 'a' | 'b' | 'c' | 'd';
};

// Server xử lý (giản lược)
function onAnswer(player, payload: AnswerPayload) {
  if (payload.questionId !== player.pendingQuestionId) return; // chặn trả lời câu cũ/sai phiên
  if (Date.now() > player.questionDeadline) return; // chặn trả lời trễ dù client báo kịp
  const q = questionBank.get(payload.questionId);
  const isCorrect = q.correct_answer === payload.choice;
  if (isCorrect) player.score += q.pointValue;
  player.state = 'MOVING'; // thoát ANSWERING ngay
}
```

Nguyên tắc bất biến: **mọi thời gian (deadline) được tính theo đồng hồ server**, client chỉ hiển thị đồng hồ đếm ngược tham khảo. Không tin `Date.now()` từ client trong bất kỳ tính toán điểm/thời hạn nào.

**4. Sự liền mạch giữa "Hành động" và "Tư duy" (BỔ SUNG — nhóm rủi ro mới, chưa có ở bản trước).**
Đây là rủi ro UX đặc thù của thể loại game này: chuyển đột ngột từ phản xạ (di chuyển) sang tư duy (đọc/chọn đáp án) dễ làm "gãy" cảm giác chơi nếu giao diện xử lý kém. CHỐT 3 quyết định:

- **Giao diện câu hỏi:** hiển thị dạng overlay bán trong suốt (semi-transparent) đặt ở 1 góc cố định (ví dụ góc dưới màn hình), **tuyệt đối không pop-up full-screen che bản đồ**. Người chơi đang trả lời vẫn phải nhìn thấy phần bản đồ quanh vị trí rắn của họ, để biết mồi gần đó còn hay đã bị ăn mất — đây là một phần tạo cảm giác risk/reward khi đứng yên (xem mục 4 dưới).
- **Phản hồi vi mô (micro-interactions):** hiệu ứng đúng/sai phải hiển thị trong **dưới 200ms** sau khi server xác nhận kết quả (không phải sau khi người chơi bấm — phải đợi server chấm, nhưng UI phải phản hồi ngay khi có kết quả về, không trễ thêm animation rườm rà). Âm thanh ngắn phân biệt rõ correct/wrong.
- **Đồng bộ đồng hồ đếm ngược (SỬA LẠI — bản trước dùng `clientServerTimeOffset` đo 1 lần khi join phòng có rủi ro thực tế):** vấn đề là ping không ổn định suốt trận (Wi-Fi/4G có thể từ 30ms lên 150ms giữa trận), nếu offset chỉ đo 1 lần lúc vào phòng, đồng hồ sẽ lệch dần về cuối trận khi mạng đổi. CHỐT giải pháp đơn giản và chắc hơn — **không cố đo offset chính xác, chỉ cần đảm bảo client luôn phục theo lệnh server**:
  1. Client tự chạy đếm ngược 10 giây bằng `requestAnimationFrame` (mượt mắt) ngay khi nhận `QuestionPayload`, không cần đồng bộ chính xác tuyệt đối với server ở giai đoạn đang đếm.
  2. Server tự động thoát trạng thái `ANSWERING` khi hết 10 giây (theo đồng hồ server) và broadcast message kết quả (`answerResult` hoặc `timeUp`).
  3. **Nguyên tắc bắt buộc:** client luôn ưu tiên tuyệt đối lệnh từ server — ngay khi nhận được message đóng câu hỏi (do trả lời xong hoặc hết giờ), **đóng UI câu hỏi ngay lập tức**, bất kể đồng hồ local trên client đang hiển thị còn bao nhiêu giây. Không có trường hợp nào client tự quyết định "còn giờ" hay "hết giờ" để tính điểm — chỉ server mới có quyền đó.
  Cách này không cần đo round-trip ping, không bị lệch theo thời gian, và UX vẫn liền mạch vì phần hiển thị (đếm ngược cho đẹp mắt) hoàn toàn tách biệt khỏi phần quyết định (đóng/mở UI theo lệnh server).

**5. Risk/Reward khi đứng yên trả lời (BỔ SUNG — làm rõ thêm cho mục 2 ở trên, không phải vấn đề mới mà là cơ chế tăng cường).**
Để mục "lợi thế tạm dừng an toàn" (mục 2) có đối trọng rõ ràng hơn bằng cảm giác thực tế (không chỉ về mặt số liệu), CHỐT thêm: ngay sau khi rắn thoát trạng thái `ANSWERING` (trả lời xong hoặc hết giờ), server gửi 1 thông báo ngắn nếu có mồi giá trị cao (vàng/kim cương) đã bị ăn trong phạm vi gần (ví dụ bán kính 5 ô) trong lúc người chơi đang trả lời — ví dụ: "Trong lúc bạn trả lời, 1 mồi vàng gần đó đã bị ăn mất". Đây chỉ là thông báo hiển thị (toast nhỏ, tự ẩn sau 2–3s), không ảnh hưởng điểm số hay logic — mục đích tạo FOMO để thúc đẩy người chơi quay lại di chuyển nhanh, tăng cảm giác "thế giới vẫn trôi" trong lúc đứng yên. Đây là tính năng có thể làm ở sprint sau (không phải MVP lõi), nhưng nên thiết kế sẵn event `nearbyFoodConsumed` ở server từ đầu để dễ bổ sung UI sau mà không phải sửa lại Collision Engine.

---

## PHẦN C — KIẾN TRÚC KỸ THUẬT (CHỐT)

### C1. Stack tổng thể

| Lớp | Công nghệ | Vai trò |
|---|---|---|
| Frontend framework | Next.js + TypeScript | UI, routing, trang lobby/kết quả |
| Game engine | Phaser | Render bản đồ, rắn, mồi, hiệu ứng |
| Game server | Colyseus | Phòng chơi, đồng bộ realtime, luật chơi, chống gian lận |
| Database | PostgreSQL (qua Supabase) | Người dùng, câu hỏi, lịch sử trận, xếp hạng |
| BaaS | Supabase | Auth, Storage, (Realtime chỉ dùng cho lobby) |
| State client (frontend) | Zustand | Quản lý state ngoài Phaser (UI, điểm số, câu hỏi hiện tại) |
| Validation | Zod | Validate dữ liệu 2 đầu client/server |

**Đánh giá:** Đây là stack hợp lý và là lựa chọn phổ biến cho game multiplayer realtime quy mô vừa (đến vài trăm phòng đồng thời). Không over-engineer (không cần Kubernetes/microservices ở giai đoạn MVP), nhưng đủ chuẩn để scale sau. Quan trọng nhất: **tách rõ Colyseus (state authoritative, realtime) khỏi Supabase (persistent storage, không realtime cho gameplay)** — bản gốc đã làm đúng, đây là quyết định kiến trúc then chốt nhất của toàn bộ thiết kế.

### C2. Sơ đồ hệ thống

```text
Player (Browser)
   │
   ▼
Next.js + Phaser (Client)
   │
   │  WebSocket (gameplay realtime)
   ▼
Colyseus Server  ──── là "trọng tài" duy nhất của trận đấu
   │
   ├── Room Lifecycle (tạo/join/start/end phòng)
   ├── Snake State (vị trí, hướng, tốc độ)
   ├── Food Spawner (sinh mồi, tránh trùng vị trí)
   ├── Question Engine (chọn câu hỏi, gửi, nhận đáp án, chấm)
   ├── Score Engine (cộng điểm, chống gian lận)
   ├── Collision Engine (tường, rắn-rắn)
   └── Match Timer (đếm 10 phút, kết thúc trận)
   │
   │  REST/SQL (không realtime)
   ▼
Supabase
   ├── Auth (Google / GitHub / Email OTP)
   ├── PostgreSQL (users, questions, matches, match_players)
   └── Storage (avatar, hình ảnh)
```

### C3. Schema dữ liệu (mở rộng so với bản gốc)

```sql
-- users
id uuid primary key
name text
avatar_url text
created_at timestamptz default now()

-- questions
id uuid primary key
question text
option_a text
option_b text
option_c text
option_d text
correct_answer char(1)        -- 'a' | 'b' | 'c' | 'd'
difficulty smallint           -- 1=dễ, 2=trung, 3=khó
category text                 -- 'science' | 'history' | ...
created_at timestamptz default now()

-- matches
id uuid primary key
room_id text
started_at timestamptz
ended_at timestamptz
winner_id uuid references users(id)
player_count smallint         -- bổ sung: để thống kê quy mô trận

-- match_players
id uuid primary key
match_id uuid references matches(id)
user_id uuid references users(id)
score int default 0
correct_answers int default 0
wrong_answers int default 0   -- bổ sung: để phân tích tỉ lệ đúng/sai
foods_collected int default 0
rank smallint

-- match_question_log (bổ sung — quan trọng cho chống lặp câu hỏi & thống kê)
id uuid primary key
match_id uuid references matches(id)
user_id uuid references users(id)
question_id uuid references questions(id)
answered_choice char(1)
is_correct boolean
answered_at timestamptz
```

**Bảng `match_question_log` không có trong bản gốc** nhưng cần thiết để:
1. Đảm bảo không hỏi lại câu đã hỏi trong cùng trận (logic chống lặp ở mức server, nhưng cần log để kiểm tra/khôi phục khi server restart).
2. Phân tích sau này: câu nào khó/dễ thực tế, chủ đề nào người chơi yếu — dữ liệu hữu ích nếu sản phẩm hướng tới giáo dục.

### C4. Luồng gameplay (chốt, có bổ sung bước thiếu)

**ĐẢO QUYẾT ĐỊNH so với bản trước** về thời điểm ghi DB: không ghi `matches` record ngay khi bắt đầu trận, mà giữ toàn bộ trạng thái trận đấu (điểm số, log câu hỏi, số mồi ăn được...) **trong RAM của Colyseus room** suốt 10 phút, chỉ thực hiện **đúng 1 lần ghi hàng loạt (batch write)** xuống Supabase khi trận kết thúc. Lý do đảo: gọi DB liên tục trong lúc trận đang chạy (ví dụ ghi mỗi lần ăn mồi/trả lời câu hỏi) tạo round-trip không cần thiết, có thể gây độ trễ/jitter ảnh hưởng đến tick loop — trong khi không có lý do gameplay nào cần dữ liệu này tồn tại trong DB *trước khi* trận kết thúc.

```text
1. Đăng nhập (Supabase Auth)
2. Host tạo phòng → mã phòng (ví dụ ABCD12)
3. Người chơi join phòng (Colyseus room theo roomId)
4. Host bấm Start → Colyseus khởi tạo Match state HOÀN TOÀN TRONG RAM
   (chưa ghi gì xuống Postgres ở bước này)
5. Gameplay loop (lặp lại liên tục trong 10 phút, mọi thứ chỉ cập nhật RAM/`@colyseus/schema`):
   Spawn Food → Player Eat Food → Server chọn Question (loại trừ câu đã hỏi)
   → Gửi Question kèm thời hạn 10s tới đúng Player đó (không broadcast toàn phòng)
   → Player trả lời → Server validate (đúng giờ? đúng đáp án theo DB câu hỏi, không theo client?)
   → Cộng điểm + append vào mảng log trong RAM (chưa ghi DB)
6. Hết 10 phút → Server khóa input, tính rank từ state RAM
   → THỰC HIỆN 1 LẦN: batch insert toàn bộ vào Postgres
     (1 row `matches`, N rows `match_players`, M rows `match_question_log` — dùng 1 transaction)
   → Trả kết quả cho toàn phòng → Client hiển thị bảng xếp hạng
```

**Ngoại lệ cần xử lý — BỔ SUNG lưới an toàn giá rẻ:** nếu server crash giữa trận, toàn bộ dữ liệu RAM của trận đó mất (chưa kịp ghi DB). Với bối cảnh thực tế (sự kiện lớp học/công ty, 20 người chơi 10 phút, không có kết quả để chấm điểm là một thất bại thực sự với người tổ chức), nên thêm 1 lưới an toàn rẻ tiền:

- Mỗi khi 1 player trả lời xong 1 câu, server ghi thêm **1 dòng JSON** vào file log cục bộ trên đĩa container (`fs.appendFileSync('/tmp/match_<roomId>.log', JSON.stringify(entry) + '\n')`). Ghi 1 dòng nhỏ là việc đồng bộ rất nhanh (<1ms), không ảnh hưởng đáng kể đến tick loop 50ms.
- Batch write cuối trận thành công → xoá file log đó.
- Server crash giữa trận → file log vẫn còn, dùng để nạp lại thủ công vào DB bằng 1 script nhỏ.

**Lưu ý quan trọng cần xác minh trước khi dựa vào cơ chế này (KHÔNG mặc định đúng):** giải pháp trên chỉ hoạt động nếu filesystem của container **persistent qua restart** — tức là khi Colyseus instance bị crash và **tự khởi động lại** (restart, không phải bị xoá hẳn container), file ở `/tmp` hoặc đường dẫn đã ghi vẫn còn đó để đọc lại. Đây **không phải mặc định đúng trên mọi PaaS**: nhiều nền tảng container (đặc biệt khi auto-scale hoặc deploy lại) dùng **ephemeral filesystem** — container mới khởi động từ image gốc, mọi file ghi trong lúc chạy (kể cả `/tmp`) biến mất hoàn toàn, không liên quan gì đến việc trận đấu có crash hay không. **CHỐT hành động bắt buộc:** trước khi dựa vào log file này làm lưới an toàn thật, phải kiểm tra cụ thể chính sách persistent disk của plan đang dùng trên Railway/Render (Railway có volume riêng phải gắn thêm, Render có "Persistent Disk" là add-on trả phí, không có sẵn ở plan free/starter). Nếu plan đang dùng không có persistent disk, file log sẽ mất đồng thời với crash — tức là **không có lưới an toàn thật**, chỉ là cảm giác an toàn giả. Nếu xác nhận không có persistent disk và không muốn trả thêm phí cho nó, phương án thực tế hơn là chấp nhận rủi ro mất dữ liệu (đánh đổi ban đầu) hoặc dùng dịch vụ ngoài container (ví dụ ghi thẳng vào 1 bảng Supabase `match_progress_log` mỗi lần trả lời câu hỏi — chấp nhận round-trip DB thường xuyên hơn để đổi lấy an toàn dữ liệu thật, đánh đổi ngược lại với lý do đảo quyết định ban đầu, cần cân nhắc theo mức độ quan trọng của sự kiện thực tế đang chạy).

**Điểm bổ sung quan trọng:** câu hỏi chỉ gửi cho **người chơi vừa ăn mồi đó**, không gửi cho cả phòng — bản gốc mô tả khá chung, dễ hiểu nhầm là hỏi đồng loạt. Mỗi người có câu hỏi và đồng hồ 10 giây riêng của mình.

### C5. Các vấn đề kỹ thuật — đã chốt giải pháp

#### 1. Tick rate / netcode

**ĐẢO QUYẾT ĐỊNH so với bản trước — bỏ hoàn toàn Client-Side Prediction.**

Lý do đảo: rắn di chuyển trên lưới rời rạc (grid-based), không cần độ chính xác sub-pixel/liên tục như game bắn súng hay platformer — prediction chỉ thực sự cần khi độ trễ cảm nhận giữa input và phản hồi gây khó chịu rõ rệt ở chuyển động liên tục. Với grid 20Hz, độ trễ round-trip thực tế (thường 20–80ms trong nước, qua Railway/Render) nhỏ hơn một bước lưới, nên cảm giác trễ là không đáng kể. Bỏ prediction giúp:
- Giảm ~50% lượng code mạng (không cần viết logic reconciliation, không cần buffer lịch sử state để rollback).
- Loại bỏ hoàn toàn bug "giật lùi" (rubber-banding) — nguồn lỗi UX phổ biến nhất của prediction cài sai.

**CHỐT luồng input/render (pure server-authoritative):**
```
Người chơi bấm phím → Client gửi hướng đi lên server ngay
                     → Server nhận, cập nhật state ở tick kế tiếp (tối đa 50ms sau)
                     → Server broadcast state mới (delta) cho toàn phòng
                     → MỌI client (kể cả chủ rắn) chỉ render theo state nhận từ server
```
- Server tick **20 lần/giây** (50ms/tick) cho cập nhật vị trí, va chạm, ăn mồi.
- Đồng bộ state qua `@colyseus/schema` — chỉ gửi phần state thay đổi (delta), không tự viết delta-compression.
- Để chuyển động không bị "khựng" giữa 2 tick, client nội suy (interpolate) hình ảnh rắn giữa state cũ và state mới trong khoảng 50ms — đây là kỹ thuật render thuần (không phải prediction), không ảnh hưởng đến tính authoritative vì không đoán trước kết quả, chỉ vẽ mượt giữa 2 điểm dữ liệu đã có.
- Input gửi lên: chỉ gửi hướng đi (`up/down/left/right`), không gửi vị trí.

#### 2. Disconnect / reconnect

**CHỐT:**
- Mất kết nối → server giữ nguyên rắn tại vị trí cuối, chuyển trạng thái `FROZEN` (không bị coi là rời phòng, không bị xóa khỏi bảng điểm).
- Cho phép reconnect trong vòng **30 giây** (dùng `room.allowReconnection(client, 30)` — API có sẵn của Colyseus, không cần tự xây session token riêng).
- Quá 30 giây không reconnect → rắn chuyển trạng thái `DISCONNECTED`: vẫn giữ điểm số đã có trên bảng xếp hạng cuối trận, nhưng rắn biến mất khỏi bản đồ (để không cản đường người khác vô lý) và không thể ăn thêm mồi.
- Khi reconnect thành công trong 30 giây: rắn trở lại đúng vị trí cũ, giữ nguyên điểm, không bị phạt.

#### 3. Server là nguồn sự thật duy nhất (authoritative server)

**CHỐT nguyên tắc bất biến cho toàn bộ game-server:**
- Client **chỉ gửi input** (hướng di chuyển, lựa chọn đáp án). Client **không bao giờ gửi** "tôi đã ăn mồi", "tôi đã va chạm", "tôi thắng" — mọi kết quả này do server tự tính từ state nó đang giữ.
- Mọi thay đổi điểm số, vị trí, trạng thái rắn chỉ được ghi bởi code chạy trong Colyseus room (server), không có code client nào được quyền ghi trực tiếp vào state đồng bộ.
- Quy tắc kiểm tra khi code: nếu một dòng code trong Colyseus room đang **đọc** một giá trị do client gửi lên và **trực tiếp dùng giá trị đó làm kết quả cuối** (vd: điểm số, kết quả đúng/sai) mà không tự tính/tự so sánh lại ở server — đó là lỗi vi phạm nguyên tắc này, phải sửa.

#### 4. Race condition khi 2 rắn cùng ăn 1 mồi

**CHỐT:** Vì server tick tuần tự (single-threaded event loop của Node.js/Colyseus), tại mỗi tick, server xử lý va chạm theo đúng **thứ tự vòng lặp duyệt qua danh sách rắn** (ví dụ theo thứ tự join phòng). Cụ thể:

```ts
// Trong mỗi tick (50ms), server duyệt:
for (const player of room.state.players.values()) {
  const food = findFoodAtPosition(player.headPosition);
  if (food && !food.consumed) {
    food.consumed = true; // đánh dấu NGAY để rắn duyệt sau trong cùng tick không ăn được nữa
    handleFoodEaten(player, food);
  }
}
```

Việc đánh dấu `food.consumed = true` ngay khi xử lý xong rắn đầu tiên đảm bảo không có 2 rắn nào cùng ăn 1 mồi trong cùng 1 tick — không cần lock/mutex phức tạp vì Node.js xử lý tuần tự trong 1 tick. Không có khái niệm "độ trễ mạng của client" ảnh hưởng đến phân định thắng/thua ăn mồi, vì toàn bộ quyết định nằm ở server, dựa trên state server nhận được tính đến tick đó.

#### 4b. Thuật toán spawn mồi O(1) (BỔ SUNG — vấn đề mới, chưa có ở bản trước)

**Vấn đề:** Nếu spawn mồi bằng cách random tọa độ rồi kiểm tra có trùng rắn/mồi khác không (random-and-check), trường hợp xấu nhất (bản đồ gần đầy, ví dụ cuối trận khi rắn dài ra) thuật toán phải random lại nhiều lần liên tiếp → tốn CPU bất định, có thể gây spike đúng vào tick đó, ảnh hưởng tất cả người chơi trong phòng cùng lúc.

**CHỐT giải pháp:** Server giữ một cấu trúc `freeCells: Set<cellIndex>` (hoặc mảng các index ô trống) được cập nhật tăng dần (incremental), không quét lại toàn bản đồ mỗi lần spawn:
```ts
// Khởi tạo khi tạo room: tất cả ô đều trống
const freeCells = new Set<number>(allCellIndexes);

// Khi 1 ô bị chiếm (rắn đi qua, mồi spawn vào):
freeCells.delete(cellIndex);

// Khi 1 ô được giải phóng (rắn rời khỏi ô do di chuyển, mồi bị ăn):
freeCells.add(cellIndex);

// Spawn mồi mới — O(1) trung bình:
function spawnFood(): number {
  const freeArray = Array.from(freeCells); // hoặc giữ song song 1 array để tránh convert mỗi lần
  const randomIndex = freeArray[Math.floor(Math.random() * freeArray.length)];
  freeCells.delete(randomIndex);
  return randomIndex;
}
```
Để tránh chi phí `Array.from(Set)` mỗi lần gọi (vẫn là O(n)), **CHỐT triển khai thực tế**: duy trì song song một `freeCellsArray: number[]` cùng một `Map<cellIndex, arrayPosition>` để xóa phần tử bằng swap-with-last trong O(1) thực sự (kỹ thuật "swap remove"), thay vì dùng `Set` đơn thuần. Đây là cấu trúc dữ liệu chuẩn cho spawn ngẫu nhiên O(1) trong game grid-based, áp dụng được ngay trong package `game-logic` (thuần TypeScript, test độc lập được).

#### 5. Chống gian lận câu trả lời

**CHỐT:** Xem giao thức message ở Phần B mục 3 — không gửi `correct_answer` xuống client, server tự so sánh, deadline tính theo server timestamp.

#### 6. Tải máy chủ khi nhiều phòng

**CHỐT cho MVP:** Chạy **1 Colyseus instance duy nhất**, không cần horizontal scaling. Lý do: mỗi phòng tối đa 20 người, room state nhẹ (vị trí rắn + mồi + điểm số), tick 20Hz — một instance Node.js cấu hình thường (1–2 vCPU, 1GB RAM) có thể chịu được hàng chục phòng đồng thời ở quy mô MVP/thử nghiệm thực tế (lớp học, sự kiện nội bộ).
**Ngưỡng để bắt đầu scale:** nếu CPU instance vượt 70% sustained hoặc số phòng đồng thời vượt ~50 phòng, mới cần thêm `@colyseus/proxy` + Redis presence để chạy nhiều instance. **Không làm trước khi có dữ liệu thật cho thấy cần** — tránh tốn công sớm.

#### 7. Rate limiting input di chuyển

**CHỐT:** Server giới hạn tối đa **xử lý 1 input đổi-hướng/100ms cho mỗi player** (tức tối đa 10 lần đổi hướng/giây) — đủ nhanh cho chơi thật (không ai đổi hướng nhanh hơn vậy bằng tay), đồng thời chặn được spam input từ script/bot. Input vượt ngưỡng bị server **âm thầm bỏ qua** (không phản hồi lỗi, tránh lộ thông tin về cơ chế rate limit cho người định cheat).

---

### C6. Cấu trúc Monorepo

```text
/apps
 ├── web            → Next.js (UI, lobby, kết quả)
 └── game-server    → Colyseus (toàn bộ logic trận đấu)

/packages
 ├── shared-types   → Type dùng chung (Player, Food, Question, Match...)
 ├── game-logic     → Logic thuần (spawn, va chạm, tính điểm) — KHÔNG phụ thuộc Colyseus hay Phaser, để dễ unit test
 └── ui             → Component UI dùng chung (bảng điểm, đếm ngược...)

/supabase
 ├── migrations
 └── seed           → Seed sẵn 300–500 câu hỏi cho 8 chủ đề
```

*Bổ sung lý do tách `game-logic` riêng:* nếu để logic spawn/va chạm/tính điểm nằm trực tiếp trong Colyseus room class, rất khó viết unit test (phải mock toàn bộ room). Tách thành package thuần TypeScript giúp test logic game độc lập, nhanh, không cần khởi động server. **CHỐT mục tiêu coverage:** ≥90% cho các hàm thuần trong `game-logic` (`checkCollision`, `calculateScore`, `spawnFood`, cấu trúc swap-remove ở mục C5.4b) — vì đây là phần luật chơi lõi, lỗi ở đây ảnh hưởng trực tiếp đến tính công bằng của trận đấu.

**BỔ SUNG — 2 vấn đề DX mới cần chốt trước khi code:**

**a) Schema versioning của `@colyseus/schema`.** Khi cần thêm thuộc tính mới vào state (ví dụ thêm `isShielded: boolean` cho player ở bản update sau MVP), client cũ (chưa update) có thể crash nếu đọc state không đúng cấu trúc đã biên dịch. CHỐT quy tắc thêm field an toàn: **chỉ thêm field mới ở cuối class schema, không bao giờ xóa hoặc đổi thứ tự field cũ, không đổi kiểu dữ liệu của field đã tồn tại** — đây là quy tắc bắt buộc của chính cơ chế encode/decode nhị phân của `@colyseus/schema` (không phải tự đặt ra, mà là ràng buộc kỹ thuật của thư viện). Áp dụng từ class schema đầu tiên viết ra, không chờ đến khi cần version 2 mới nghĩ tới.

**b) Tích hợp Phaser vào Next.js.** Phaser cần chiếm toàn quyền 1 `<canvas>` và dùng các API chỉ tồn tại ở browser (window, document) — xung đột trực tiếp với SSR của Next.js nếu import thẳng ở component thường. CHỐT cách làm: component chứa Phaser game phải import qua `next/dynamic` với `{ ssr: false }`, và khởi tạo Phaser instance trong `useEffect` (chỉ chạy ở client, sau khi mount) — không import `phaser` ở module scope của bất kỳ file nào có thể bị Next.js cố SSR. Đặt toàn bộ trang chơi game (route `/play/[roomId]`) làm 1 trang riêng dùng cách này, tách biệt khỏi các trang khác (lobby, kết quả) vẫn render SSR bình thường.

### C7. Thư viện cài đặt

**Frontend**
```bash
npm install phaser colyseus.js @supabase/supabase-js zustand zod
```

**Game server**
```bash
npm install colyseus @colyseus/schema nanoid zod
```

### C8. Deploy

| Thành phần | Nền tảng |
|---|---|
| Frontend | Vercel |
| Game server | Railway hoặc Render (cần WebSocket persistent connection — kiểm tra plan có hỗ trợ sticky session/WS lâu dài) |
| Database | Supabase PostgreSQL |

**Lưu ý khi deploy game server:** một số platform serverless (như Vercel) **không phù hợp cho Colyseus** vì WebSocket cần kết nối dài hạn, không phải request-response ngắn. Railway/Render là lựa chọn đúng vì chạy container dài hạn — bản gốc chọn đúng, chỉ cần lưu ý chọn plan có đủ RAM (Colyseus giữ toàn bộ state phòng trong memory).

---

## PHẦN D — ROADMAP MVP (chốt, sắp xếp lại theo phụ thuộc)

| Sprint | Nội dung | Lý do thứ tự |
|---|---|---|
| 1 | Đăng nhập, tạo phòng, tham gia phòng | Nền tảng để test mọi thứ sau cần nhiều người |
| 2 | Điều khiển rắn + đồng bộ nhiều người chơi (Colyseus) | Phải chạy được realtime trước khi thêm luật |
| 3 | Spawn mồi, ăn mồi, va chạm tường/rắn | Lõi gameplay |
| 4 | Hiện câu hỏi, trả lời, tính điểm (server-side validate) | Lớp "tri thức" — phụ thuộc sprint 3 đã ổn định |
| 5 | Vật phẩm đặc biệt (tăng tốc, khiên, hộp bí ẩn) | Tính năng phụ, thêm sau khi lõi ổn |
| 6 | Kết thúc trận, bảng xếp hạng, lưu lịch sử Supabase | Hoàn thiện chu trình 1 trận đầy đủ |

*So với bản gốc:* mình đẩy "vật phẩm đặc biệt" xuống thành sprint riêng (sprint 5) thay vì gộp ngầm vào đâu đó — vì đây là tính năng không ảnh hưởng lõi game, nên làm sau khi lõi (di chuyển + mồi + câu hỏi + điểm) đã chạy ổn định và test được với người chơi thật.

---

## PHẦN E — ĐÁNH GIÁ TỔNG THỂ

**Bản kế hoạch này khả thi và đã ở mức tốt để bắt đầu code.** Điểm mạnh lớn nhất là tách đúng vai trò: Colyseus làm trọng tài realtime, Supabase lưu trữ lâu dài — đây là quyết định kiến trúc quan trọng nhất và bản gốc đã chọn đúng ngay từ đầu, không cần sửa.

**Checklist các quyết định đã chốt — dùng làm tài liệu tham chiếu khi code:**

| # | Vấn đề | Đã chốt |
|---|---|---|
| 1 | Rắn khi trả lời câu hỏi | Trạng thái `ANSWERING`: đứng yên, miễn va chạm, ghost/bán trong suốt, đầu vẫn cản đường nhưng thân cho lướt qua |
| 2 | Số lượng mồi | `food_count = clamp(round(active_players / 3), 3, 10)`, tính lại khi join/leave |
| 3 | Lợi thế tạm dừng khi trả lời | Giữ nguyên có chủ đích; tăng cường bằng thông báo FOMO "mồi gần đó đã bị ăn" (sprint sau) |
| 4 | Đáp án đúng | Không gửi xuống client; server tự so sánh; deadline theo server timestamp |
| 5 | Ngân hàng câu hỏi | 480 câu (8 chủ đề × 3 độ khó × 20 câu); không lặp trong 1 trận; độ khó gắn với loại mồi |
| 6 | Tick rate / netcode | **20Hz, KHÔNG dùng client-side prediction** (đảo quyết định) — pure server-authoritative, client chỉ interpolate hình ảnh |
| 7 | Disconnect/reconnect | `allowReconnection` 30s; quá hạn → giữ điểm, ẩn rắn khỏi bản đồ |
| 8 | Authoritative server | Client chỉ gửi input; mọi kết quả (va chạm, ăn mồi, điểm) do server tự tính |
| 9 | Race condition ăn mồi | Đánh dấu `consumed` ngay trong vòng lặp tick, xử lý tuần tự, không cần lock |
| 10 | Spawn mồi | Cấu trúc swap-remove O(1) thực sự cho ô trống, không random-and-check (mới) |
| 11 | Ghi dữ liệu trận đấu | Toàn bộ trong RAM suốt 10 phút, **1 lần batch write** xuống Postgres khi kết thúc (đảo quyết định) |
| 12 | Tải server | 1 instance cho MVP; scale ngang chỉ khi CPU >70% hoặc >50 phòng đồng thời |
| 13 | Rate limit input | Tối đa 1 đổi-hướng/100ms mỗi player, vượt ngưỡng thì âm thầm bỏ qua |
| 14 | UX overlay câu hỏi | Bán trong suốt, góc màn hình, không che bản đồ; phản hồi đúng/sai dưới 200ms |
| 15 | Đồng bộ đếm ngược | **SỬA:** bỏ offset đo 1 lần (rủi ro lệch khi ping đổi giữa trận) → client tự vẽ đếm ngược cho mượt, nhưng luôn đóng UI ngay khi nhận lệnh server, không tự quyết theo đồng hồ local |
| 16 | Vật phẩm Tăng tốc | Giữ lại (không bỏ); **SỬA cách implement:** dùng `moveAccumulator` + vòng `while` + check va chạm sau MỖI ô di chuyển (sub-stepping) — bản trước mô tả sai cơ chế "tick riêng cho từng player", Colyseus chỉ có 1 `setInterval` chung cho cả phòng |
| 17 | Schema versioning | Chỉ thêm field mới ở cuối, không xóa/đổi thứ tự/đổi kiểu field cũ |
| 18 | Phaser + Next.js | `next/dynamic({ ssr: false })` + khởi tạo trong `useEffect`, tách route `/play/[roomId]` riêng |
| 19 | Lưới an toàn batch write | Ghi log JSON cục bộ mỗi câu trả lời, xoá khi batch write thành công; **CẦN XÁC MINH** persistent disk trên Railway/Render trước khi tin cơ chế này — nhiều plan dùng ephemeral filesystem khiến log cũng mất khi crash |

Tất cả các điểm trên không còn là "đề xuất" — đây là baseline kỹ thuật để team code theo, và mọi thay đổi sau này nên được ghi lại như một quyết định mới (có lý do), tránh trôi dần khỏi kiến trúc đã thống nhất. Mục 6, 11 là **đảo ngược** so với bản trước đó nữa; mục 15, 16 là **sửa lỗi mô tả kỹ thuật sai** (không phải đổi quyết định, mà là chính cách implement ban đầu mô tả chưa đúng với cách Colyseus/web hoạt động thực tế); mục 19 là lưới an toàn mới nhưng **có điều kiện cần xác minh**, không nên coi là đã chốt xong 100% cho đến khi kiểm tra plan hosting thật.

Phần còn lại cần làm song song, không phải quyết định kỹ thuật: bắt đầu biên soạn 480 câu hỏi ngay từ sprint 1–2 (đây là phần tốn thời gian thực tế nhất, không phụ thuộc vào code).