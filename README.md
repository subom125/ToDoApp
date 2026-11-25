# TODO App — Quản lý công việc cá nhân

Ứng dụng chạy trên máy cá nhân. Giao diện tiếng Việt, backend Node.js và cơ sở dữ liệu SQLite cục bộ.

## Chạy ứng dụng

Cần **Node.js 24 trở lên**. Mở terminal trong thư mục chứa `package.json` rồi chạy:

```powershell
node server.js
```

Mở http://127.0.0.1:3000. SQLite tự tạo file `data/tasks.sqlite` khi khởi động. Thêm vài công việc để xem thống kê thực tế.

Để chạy bản không có cơ sở dữ liệu, dừng máy chủ hiện tại bằng Ctrl+C rồi chạy:

```powershell
node server.js --memory
```

Bản RAM có sẵn một số công việc mẫu. Thay đổi trong bản này mất khi tắt máy chủ. Có thể đổi cổng bằng biến môi trường `PORT`.

## Chức năng

- Danh sách mặc định hiển thị công việc đến hạn hôm nay theo giờ Việt Nam. Bật **Hiển thị mọi ngày** để quản lý cả việc quá hạn và sắp tới.
- Tìm theo tên với chữ hoa/thường tương đương. Kết hợp bộ lọc trạng thái và mức ưu tiên.
- Thêm, sửa và xóa công việc. Có xác nhận trước khi xóa.
- Thống kê tổng số công việc, số lượng theo từng trạng thái và tỷ lệ hoàn thành. Chế độ dữ liệu mẫu có 5 công việc, trong đó 2 hoàn thành, tương ứng 40%.

## Kiến trúc và dữ liệu

```text
Trình duyệt (HTML/CSS/JS)
         │ fetch JSON
Node.js HTTP API (server.js)
         │
Kho lưu trữ (store.js)
         ├── SQLite trên đĩa (mặc định)
         └── Map trong RAM (--memory)
```

Bảng `tasks` được khai báo trong [schema.sql](schema.sql).

| Trường   | Kiểu    | Ý nghĩa                            |
| -------- | ------- | ---------------------------------- |
| id       | INTEGER | Khóa chính                         |
| title    | TEXT    | Tên công việc, tối đa 120 ký tự    |
| dueDate  | TEXT    | Ngày đến hạn, định dạng YYYY-MM-DD |
| priority | TEXT    | low, medium, high                  |
| status   | TEXT    | todo, doing, done                  |

Backend kiểm tra dữ liệu trước khi ghi. Các thao tác ghi SQLite sử dụng truy vấn tham số hóa.

| API                   | Chức năng                                                    |
| --------------------- | ------------------------------------------------------------ |
| GET /api/config       | Ngày hiện tại và chế độ lưu trữ                              |
| GET /api/tasks        | Lấy danh sách, hỗ trợ q, status, priority và scope=all       |
| POST /api/tasks       | Tạo công việc                                                |
| PUT /api/tasks/:id    | Cập nhật công việc                                           |
| DELETE /api/tasks/:id | Xóa công việc                                                |
| GET /api/stats        | Thống kê toàn bộ công việc, truyền mock=1 để xem dữ liệu mẫu |

## Kiểm thử

```powershell
node --test
```

Kiểm thử HTTP bao gồm tìm kiếm, lọc, CRUD, thống kê và dữ liệu SQLite sau khi mở lại file. Kiểm thử dùng thư mục tạm.
