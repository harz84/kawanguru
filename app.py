import os
from flask import Flask, request, jsonify, render_template, send_from_directory # render_template diperlukan
from werkzeug.utils import secure_filename
# Inisialisasi aplikasi Flask
# Flask otomatis mencari template di 'templates' dan static di 'static'
app = Flask(__name__)

# Konfigurasi folder untuk menyimpan file upload sementara
UPLOAD_FOLDER = 'uploads'
# Pastikan folder uploads ada, jika tidak buat folder tersebut
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Rute dasar untuk menyajikan file index.html dari folder templates
@app.route('/')
def serve_index():
    # Gunakan render_template untuk menyajikan file dari folder 'templates'
    return render_template('index.html')

# Flask akan otomatis menyajikan file dari folder 'static' di URL /static/
# Jadi tidak perlu route tambahan untuk CSS/JS

# Rute (endpoint) untuk API pembuatan soal (Placeholder)
# Rute (endpoint) untuk API pembuatan soal (BARU)
@app.route('/generate-soal', methods=['POST'])
def generate_questions_api():
    print("Menerima request di /generate-soal...") # Pesan untuk kita lihat di terminal

    # Cek dulu: Apakah ada file yang dikirim dengan nama 'moduleFile'?
    # 'moduleFile' ini HARUS SAMA dengan nama di script.js saat mengirim!
    if 'moduleFile' not in request.files:
        print("Error: Kunci 'moduleFile' tidak ditemukan di request.files")
        return jsonify({"error": "Tidak ada bagian file ('moduleFile') dalam request"}), 400 # Kirim pesan error ke browser

    file = request.files['moduleFile'] # Ambil file-nya

    # Cek lagi: Apakah nama file-nya kosong? (Berarti pengguna tidak pilih file)
    if file.filename == '':
        print("Error: Tidak ada file yang dipilih")
        return jsonify({"error": "Tidak ada file yang dipilih"}), 400 # Kirim pesan error ke browser

    # Jika ada file dan namanya tidak kosong...
    if file:
        # Bersihkan nama file agar aman
        filename = secure_filename(file.filename)
        # Tentukan lokasi lengkap untuk menyimpan: di dalam folder 'uploads' + nama file aman
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        try:
            # Perintahkan untuk menyimpan file ke lokasi tersebut
            file.save(filepath)
            print(f"File berhasil disimpan di: {filepath}") # Tampilkan pesan sukses di terminal

            # --- BAGIAN PEMROSESAN ISI FILE AKAN DITAMBAH DI SINI NANTI ---

            # Kirim pesan sukses kembali ke browser
            return jsonify({
                "message": f"File '{filename}' berhasil diupload dan disimpan.",
                "saved_path": filepath
            })

        except Exception as e:
            # Kalau ada error saat mencoba menyimpan file
            print(f"Error saat menyimpan file: {e}")
            return jsonify({"error": f"Gagal menyimpan atau memproses file: {str(e)}"}), 500 # Kirim pesan error ke browser
    
    # Jika ada masalah lain
    return jsonify({"error": "Terjadi kesalahan tidak diketahui saat upload"}), 500

# Menjalankan server Flask jika file ini dieksekusi langsung
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)