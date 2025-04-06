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
        event.preventDefault(); // Mencegah reload halaman

        // --- Validasi Frontend ---
        if (!fileInput.files || fileInput.files.length === 0) {
            showError("Silakan pilih file modul terlebih dahulu.");
            return;
        }
        const selectedFile = fileInput.files[0];

        // --- Reset UI sebelum request ---
        hideError();
        resultsSection.classList.add('hidden');
        questionsPreview.innerHTML = '';
        exportBtn.classList.add('hidden');
        saveChangesBtn.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Membuat Soal dengan AI...'; // Update teks tombol

        // --- Persiapan Data untuk Dikirim ---
        const formData = new FormData();
        formData.append('moduleFile', selectedFile);
        formData.append('difficulty', document.getElementById('difficulty-level').value);
        formData.append('startPage', document.getElementById('start-page').value);
        formData.append('endPage', document.getElementById('end-page').value);
        formData.append('numQuestions', document.getElementById('num-questions').value);
        formData.append('questionType', document.getElementById('question-type').value);

        // --- Kirim Data ke Backend menggunakan Fetch ---
        try {
            console.log("Mengirim FormData ke /generate-soal..."); // Log pengiriman

            const response = await fetch('/generate-soal', {
                method: 'POST',
                body: formData,
            });

            // Cek status response dari server
            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || JSON.stringify(errorData);
                } catch (e) {
                    console.warn("Tidak bisa parse error JSON dari response:", await response.text().catch(() => ''));
                }
                throw new Error(errorMsg); // Lempar error untuk ditangkap catch
            }

            // Jika response OK, baca hasilnya sebagai JSON
            const result = await response.json();
            console.log("Respons sukses dari backend:", result);

            // ===========================================================
            // === PROSES HASIL DARI BACKEND (YANG KINI BERISI SOAL) ===
            // ===========================================================
            if (result.error) {
                // Tangani jika backend secara eksplisit mengirim pesan error
                showError(`Gagal di server: ${result.error}`);
                resultsSection.classList.add('hidden');
                questionsPreview.innerHTML = ''; // Pastikan area preview kosong
            } else if (result.questions && Array.isArray(result.questions)) {
                // ---- BAGIAN UTAMA: SOAL DITERIMA DARI BACKEND ----
                hideError(); // Sembunyikan pesan error lama jika ada
                alert(result.message || "Soal berhasil dibuat!"); // Tampilkan pesan sukses dari backend

                if (result.questions.length > 0) {
                    // Panggil fungsi untuk menampilkan soal ke HTML
                    displayResults(result.questions);
                    // Tampilkan section hasil dan tombol-tombol aksi
                    resultsSection.classList.remove('hidden');
                    exportBtn.classList.remove('hidden');
                    saveChangesBtn.classList.remove('hidden');
                } else {
                    // Kasus: Proses AI berhasil tapi tidak menghasilkan soal
                    showError("Proses AI selesai, namun tidak ada soal yang dihasilkan untuk kriteria ini.");
                    resultsSection.classList.add('hidden');
                    questionsPreview.innerHTML = '';
                }
                // ---------------------------------------------------
            } else {
                 // Respons sukses tapi format tidak terduga (tidak ada 'questions')
                 console.error("Format respons tidak terduga dari backend:", result);
                 showError("Gagal memproses respons dari server (format tidak dikenali).");
                 resultsSection.classList.add('hidden');
                 questionsPreview.innerHTML = '';
            }
            // ===========================================================

        } catch (error) {
            // Tangani error fetch atau error yang dilempar dari blok .ok
            console.error("Terjadi kesalahan:", error);
            showError(`Gagal: ${error.message}`);
            resultsSection.classList.add('hidden'); // Pastikan hasil disembunyikan

        } finally {
            // --- Reset UI setelah request selesai (sukses atau gagal) ---
            loadingIndicator.classList.add('hidden'); // Sembunyikan loading
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Soal'; // Kembalikan teks tombol
        }
    });

    // --- Fungsi untuk Menampilkan Hasil Soal di Preview ---
    // (Tidak perlu diubah, sudah siap menerima array soal)
    function displayResults(questions) {
        questionsPreview.innerHTML = ''; // Kosongkan dulu

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal untuk ditampilkan.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            // Gunakan ID unik jika backend menyediakannya, jika tidak gunakan index
            questionItem.setAttribute('data-question-id', q.id || `gen-${index}`);

            // Kontainer Teks Soal
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container');
            // Tampilkan jenis soal jika ada, untuk kejelasan
            const typeLabel = q.question_type ? ` <span class="q-type">(${q.question_type.replace('_', ' ')})</span>` : '';
            textContainer.innerHTML = `<p class="question-text"><strong>${index + 1}.</strong> ${q.question_text || 'Teks soal tidak ditemukan.'}${typeLabel}</p>`;
            questionItem.appendChild(textContainer);

            // Opsi Jawaban (jika Pilihan Ganda)
            if (q.question_type === 'pilihan_ganda' && q.options && Array.isArray(q.options) && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options');
                const optionsList = document.createElement('ul');
                q.options.forEach(opt => {
                    const li = document.createElement('li');
                    // Tandai jawaban benar jika ada (hanya untuk referensi, bisa di-styling CSS)
                    if (q.correct_answer && opt === q.correct_answer) {
                        // li.classList.add('correct-option'); // Tambah class jika mau di-styling
                        li.innerHTML = `${opt} <i>(Jawaban Benar)</i>`; // Atau tambahkan teks
                    } else {
                       li.textContent = opt;
                    }
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList);
                questionItem.appendChild(optionsDiv);
            }
            // Anda bisa menambahkan tampilan untuk jawaban benar tipe 'benar_salah' di sini jika mau
            else if (q.question_type === 'benar_salah' && q.correct_answer) {
                 const answerDiv = document.createElement('div');
                 answerDiv.classList.add('correct-answer-display');
                 answerDiv.innerHTML = `<p><small>Jawaban: ${q.correct_answer}</small></p>`;
                 questionItem.appendChild(answerDiv);
            }


            // Tombol Aksi (Edit, Hapus)
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('edit-actions');

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => toggleEditMode(questionItem);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Hapus';
            deleteButton.classList.add('delete');
            deleteButton.onclick = () => {
                 if (confirm('Yakin ingin menghapus soal ini?')) {
                     questionItem.remove();
                     // TODO: Update data JS jika perlu (misal sebelum save/export)
                 }
            };

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            questionItem.appendChild(actionsDiv);

            questionsPreview.appendChild(questionItem);
        });
    }

     // --- Fungsi untuk Mengaktifkan/Menonaktifkan Mode Edit Soal ---
     // (Tidak perlu diubah, tapi pastikan class 'edit-textarea' ada di CSS jika belum)
    function toggleEditMode(questionItem) {
        const textContainer = questionItem.querySelector('.question-text-container');
        const editButton = questionItem.querySelector('.edit-actions button:not(.delete)');
        const isEditing = textContainer.querySelector('textarea.edit-textarea'); // Lebih spesifik

        if (isEditing) {
            // --- Simpan perubahan dari mode Edit ---
            const newText = isEditing.value;
            const questionNumberStrong = textContainer.querySelector('strong');
            const typeSpan = textContainer.querySelector('span.q-type'); // Simpan tipe jika ada
            
            // Bangun ulang HTML teks soal
            textContainer.innerHTML = `<p class="question-text">${questionNumberStrong ? questionNumberStrong.outerHTML : ''} ${newText}${typeSpan ? typeSpan.outerHTML : ''}</p>`;
            
            editButton.textContent = 'Edit';
            // TODO: Simpan perubahan ini ke struktur data JS jika diperlukan (misal, array soal di memori)
        } else {
            // --- Masuk ke mode Edit ---
            const questionNumberStrong = textContainer.querySelector('.question-text strong');
            const typeSpan = textContainer.querySelector('span.q-type');
            const currentFullText = textContainer.querySelector('.question-text').innerHTML;
            
            // Ekstrak teks asli saja (tanpa nomor dan tipe)
            let currentContent = currentFullText;
            if (questionNumberStrong) currentContent = currentContent.replace(questionNumberStrong.outerHTML, '');
            if (typeSpan) currentContent = currentContent.replace(typeSpan.outerHTML, '');
            currentContent = currentContent.trim(); // Hapus spasi ekstra

            // Ganti <p> dengan <strong> (jika ada) dan <textarea>
            textContainer.innerHTML = `
                ${questionNumberStrong ? questionNumberStrong.outerHTML : ''}
                <textarea class="edit-textarea">${currentContent}</textarea>
                ${typeSpan ? typeSpan.outerHTML : ''}
            `;
            
            const textarea = textContainer.querySelector('textarea.edit-textarea');
            textarea.style.width = '98%'; // Pastikan lebar sesuai
            textarea.style.minHeight = '60px'; // Atur tinggi minimal
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length); // Kursor ke akhir
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
        // Logika untuk mengambil data soal dari preview (termasuk editan) dan mengekspornya
    });

    saveChangesBtn.addEventListener('click', () => {
        alert('Fungsi Simpan Perubahan (ke server/database) belum diimplementasikan.');
        // Logika untuk mengambil data soal yg diedit dan mengirim ke backend
    });

}); // Akhir dari DOMContentLoaded