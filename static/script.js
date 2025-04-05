document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen DOM ---
    const form = document.getElementById('question-generator-form');
    const generateBtn = document.getElementById('generate-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    const questionsPreview = document.getElementById('questions-preview');
    const errorMessage = document.getElementById('error-message');
    const exportBtn = document.getElementById('export-btn');
    const saveChangesBtn = document.getElementById('save-changes-btn');
    const fileInput = document.getElementById('module-file');

    // --- Event Listener Utama untuk Form Submission ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Mencegah reload halaman standar

        // --- Validasi Sederhana di Frontend ---
        if (!fileInput.files || fileInput.files.length === 0) {
            showError("Silakan pilih file modul terlebih dahulu.");
            return;
        }
        const selectedFile = fileInput.files[0];
        // Anda bisa menambahkan validasi ukuran file atau tipe lebih lanjut di sini jika perlu

        // --- Reset UI sebelum request ---
        hideError();
        resultsSection.classList.add('hidden');
        questionsPreview.innerHTML = ''; // Kosongkan preview lama
        exportBtn.classList.add('hidden'); // Sembunyikan tombol aksi
        saveChangesBtn.classList.add('hidden');
        loadingIndicator.classList.remove('hidden'); // Tampilkan loading
        generateBtn.disabled = true;
        generateBtn.textContent = 'Sedang Memproses...';

        // --- Persiapan Data untuk Dikirim ---
        const formData = new FormData();
        // PENTING: Kunci 'moduleFile' harus SAMA dengan yang diharapkan backend Flask (request.files['moduleFile'])
        formData.append('moduleFile', selectedFile);
        formData.append('difficulty', document.getElementById('difficulty-level').value);
        formData.append('startPage', document.getElementById('start-page').value);
        formData.append('endPage', document.getElementById('end-page').value);
        formData.append('numQuestions', document.getElementById('num-questions').value);
        formData.append('questionType', document.getElementById('question-type').value);

        // --- Kirim Data ke Backend menggunakan Fetch ---
        try {
            // Log data yang dikirim (kecuali isi file) untuk debugging
            console.log("Mengirim FormData ke /generate-soal:");
            for (let pair of formData.entries()) {
                if (pair[1] instanceof File) {
                    console.log(`${pair[0]}: ${pair[1].name} (type: ${pair[1].type}, size: ${pair[1].size} bytes)`);
                } else {
                    console.log(`${pair[0]}: ${pair[1]}`);
                }
            }

            // Melakukan request POST ke endpoint Flask
            const response = await fetch('/generate-soal', {
                method: 'POST',
                body: formData, // Kirim data form termasuk file
                // Browser akan otomatis mengatur header 'Content-Type: multipart/form-data'
            });

            // Cek status response dari server
            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try {
                    // Coba dapatkan pesan error spesifik dari body JSON response (jika ada)
                    const errorData = await response.json();
                    errorMsg = errorData.error || JSON.stringify(errorData); // Ambil 'error' jika ada
                } catch (e) {
                    // Jika body response bukan JSON atau kosong
                    console.warn("Tidak bisa parse error JSON dari response:", await response.text().catch(() => ''));
                }
                // Lempar error untuk ditangkap oleh blok catch
                throw new Error(errorMsg);
            }

            // Jika response OK (status 2xx), baca hasilnya sebagai JSON
            const result = await response.json();
            console.log("Respons sukses dari backend:", result);

            // --- Proses Hasil dari Backend ---
            // SAAT INI: Backend hanya mengembalikan pesan sukses upload.
            // NANTI: Backend akan mengembalikan daftar soal (`result.questions`).

            // Tampilkan pesan sukses sementara (karena belum ada soal)
            alert(`Proses di backend selesai: ${result.message}`);
            // Jika backend NANTI mengembalikan soal, uncomment baris di bawah dan hapus alert:
            // if (result.questions && result.questions.length > 0) {
            //     displayResults(result.questions);
            //     resultsSection.classList.remove('hidden');
            //     exportBtn.classList.remove('hidden');
            //     saveChangesBtn.classList.remove('hidden');
            // } else {
            //     showError("Tidak ada soal yang berhasil dibuat.");
            // }

        } catch (error) {
            // Tangani error (network error, error dari server, dll.)
            console.error("Terjadi kesalahan:", error);
            showError(`Gagal: ${error.message}`);
            resultsSection.classList.add('hidden'); // Pastikan hasil disembunyikan jika error

        } finally {
            // --- Reset UI setelah request selesai (sukses atau gagal) ---
            loadingIndicator.classList.add('hidden'); // Sembunyikan loading
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Soal';
        }
    });

    // --- Fungsi untuk Menampilkan Hasil Soal di Preview ---
    // (Fungsi ini belum akan menampilkan apa-apa sampai backend mengirimkan data soal)
    function displayResults(questions) {
        questionsPreview.innerHTML = ''; // Kosongkan dulu

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal yang dapat dihasilkan.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            questionItem.setAttribute('data-question-id', q.id || index); // Gunakan ID dari backend jika ada

            // Kontainer Teks Soal
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container');
            textContainer.innerHTML = `<p class="question-text"><strong>${index + 1}.</strong> ${q.text}</p>`;
            questionItem.appendChild(textContainer);

            // Opsi Jawaban (jika ada, misal Pilihan Ganda)
            if (q.options && Array.isArray(q.options) && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options');
                const optionsList = document.createElement('ul');
                q.options.forEach(opt => {
                    const li = document.createElement('li');
                    li.textContent = opt;
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList);
                questionItem.appendChild(optionsDiv);
                // Di sini bisa ditambahkan logika edit opsi jika diperlukan
            }

            // Tombol Aksi (Edit, Hapus)
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('edit-actions');

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => toggleEditMode(questionItem); // Panggil fungsi edit

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Hapus';
            deleteButton.classList.add('delete');
            deleteButton.onclick = () => {
                 if (confirm('Yakin ingin menghapus soal ini?')) {
                     questionItem.remove();
                     // TODO: Idealnya, data soal di JavaScript juga diupdate
                 }
            };

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            questionItem.appendChild(actionsDiv);

            questionsPreview.appendChild(questionItem);
        });
    }

     // --- Fungsi untuk Mengaktifkan/Menonaktifkan Mode Edit Soal ---
    function toggleEditMode(questionItem) {
        const textContainer = questionItem.querySelector('.question-text-container');
        const editButton = questionItem.querySelector('.edit-actions button:not(.delete)');
        const isEditing = textContainer.querySelector('textarea');

        if (isEditing) {
            // --- Simpan perubahan dari mode Edit ---
            const newText = isEditing.value;
            const questionNumber = textContainer.querySelector('strong').innerHTML; // Ambil nomor lagi
            textContainer.innerHTML = `<p class="question-text"><strong>${questionNumber}</strong> ${newText}</p>`;
            editButton.textContent = 'Edit';
            // TODO: Simpan perubahan ini ke array/object data soal di JavaScript
            // const questionId = questionItem.getAttribute('data-question-id');
            // updateQuestionData(questionId, newText, ...);
        } else {
            // --- Masuk ke mode Edit ---
            const questionNumber = textContainer.querySelector('.question-text strong').innerHTML;
            // Ambil teks saja, tanpa nomor
            const currentContent = textContainer.querySelector('.question-text').innerText.replace(questionNumber, '').trim();
            // Ganti <p> dengan <strong> dan <textarea>
            textContainer.innerHTML = `<strong>${questionNumber}</strong> <textarea class="edit-textarea">${currentContent}</textarea>`;
            // Fokuskan ke textarea
            const textarea = textContainer.querySelector('textarea');
            textarea.focus();
            // Set kursor ke akhir teks
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            editButton.textContent = 'Simpan';
        }
    }

    // --- Fungsi Utilitas untuk Error Handling ---
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

    // --- Event Listener untuk Tombol Aksi Tambahan (Placeholder) ---
    exportBtn.addEventListener('click', () => {
        alert('Fungsi Export Soal belum diimplementasikan.');
        // Logika untuk mengambil data soal dari preview dan mengekspornya
    });

    saveChangesBtn.addEventListener('click', () => {
        alert('Fungsi Simpan Perubahan (ke server) belum diimplementasikan.');
        // Logika untuk mengambil data soal yang sudah diedit dan mengirim ke backend
    });

}); // Akhir dari DOMContentLoaded