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

    // --- Variabel untuk menyimpan data soal yang ditampilkan (penting untuk edit) ---
    let displayedQuestionsData = [];

    // --- Event Listener Utama untuk Form Submission ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Mencegah reload halaman

        if (!fileInput.files || fileInput.files.length === 0) {
            showError("Silakan pilih file modul terlebih dahulu.");
            return;
        }
        const selectedFile = fileInput.files[0];

        // Reset UI
        hideError();
        resultsSection.classList.add('hidden');
        questionsPreview.innerHTML = '';
        exportBtn.classList.add('hidden');
        saveChangesBtn.classList.add('hidden');
        displayedQuestionsData = []; // Kosongkan data lama
        loadingIndicator.classList.remove('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Membuat Soal dengan AI...';

        const formData = new FormData();
        formData.append('moduleFile', selectedFile);
        formData.append('difficulty', document.getElementById('difficulty-level').value);
        formData.append('startPage', document.getElementById('start-page').value);
        formData.append('endPage', document.getElementById('end-page').value);
        formData.append('numQuestions', document.getElementById('num-questions').value);
        formData.append('questionType', document.getElementById('question-type').value);

        try {
            console.log("Mengirim FormData ke /generate-soal...");
            const response = await fetch('/generate-soal', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || JSON.stringify(errorData);
                } catch (e) { /* ignore if error body isn't json */ }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            console.log("Respons sukses dari backend:", result);

            // Proses Hasil dari Backend
            if (result.error) {
                showError(`Gagal di server: ${result.error}`);
            } else if (result.questions && Array.isArray(result.questions)) {
                hideError();
                alert(result.message || "Soal berhasil dibuat!");

                if (result.questions.length > 0) {
                    // PENTING: Simpan data soal untuk digunakan saat edit
                    displayedQuestionsData = result.questions;
                    displayResults(displayedQuestionsData); // Tampilkan soal
                    resultsSection.classList.remove('hidden');
                    exportBtn.classList.remove('hidden');
                    saveChangesBtn.classList.remove('hidden');
                } else {
                    showError("Proses AI selesai, namun tidak ada soal yang dihasilkan.");
                }
            } else {
                 console.error("Format respons tidak terduga:", result);
                 showError("Gagal memproses respons server (format tidak dikenali).");
            }

        } catch (error) {
            console.error("Terjadi kesalahan:", error);
            showError(`Gagal: ${error.message}`);
        } finally {
            // Reset UI setelah selesai
            loadingIndicator.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Buat Soal';
        }
    });

    // --- Fungsi untuk Menampilkan Hasil Soal ---
    function displayResults(questions) {
        questionsPreview.innerHTML = ''; // Kosongkan dulu

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal untuk ditampilkan.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            const uniqueId = q.id || `gen-${index}`; // Gunakan ID dari backend jika ada
            questionItem.setAttribute('data-question-id', uniqueId);

            // === Kontainer Teks Pertanyaan ===
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container');
            // **IMPROVEMENT 1: Hilangkan label tipe soal dari sini**
            textContainer.innerHTML = `<p class="question-text"><strong>${index + 1}.</strong> ${q.question_text || 'Teks soal tidak ditemukan.'}</p>`;
            questionItem.appendChild(textContainer);

            // === Opsi Jawaban (jika Pilihan Ganda) ===
            if (q.question_type === 'pilihan_ganda' && q.options && Array.isArray(q.options) && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options');
                const optionsList = document.createElement('ul');
                optionsList.classList.add('options-list'); // Tambahkan class untuk target edit
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f']; // Map index ke huruf (tambah jika perlu)

                q.options.forEach((opt, optIndex) => {
                    const li = document.createElement('li');
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex); // Default a,b,c,...
                    // Tampilkan huruf + teks opsi
                    li.innerHTML = `<span class="option-letter">${letter}.</span> <span class="option-text">${opt}</span>`;
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList); // Tambah list opsi dulu

                // **IMPROVEMENT 3: Tampilkan Jawaban Benar di bawah opsi**
                if (q.correct_answer) {
                    const correctOptionIndex = q.options.findIndex(opt => opt === q.correct_answer);
                    if (correctOptionIndex !== -1) { // Jika teks jawaban benar ada di opsi
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        const answerDisplay = document.createElement('p');
                        answerDisplay.classList.add('correct-answer-display'); // Class untuk styling
                        answerDisplay.innerHTML = `<i>Jawaban Benar: ${correctAnswerLetter}</i>`;
                        optionsDiv.appendChild(answerDisplay); // Tambah di bawah list
                    } else {
                         // Jika teks jawaban benar tidak cocok (mungkin AI salah format)
                         console.warn(`Jawaban benar "${q.correct_answer}" tidak ditemukan di opsi soal ${index + 1}. Menampilkan teks.`);
                         const answerDisplay = document.createElement('p');
                         answerDisplay.classList.add('correct-answer-display', 'warning');
                         answerDisplay.innerHTML = `<i>Jawaban Benar (Teks Asli): ${q.correct_answer}</i>`;
                         optionsDiv.appendChild(answerDisplay);
                    }
                }
                questionItem.appendChild(optionsDiv); // Tambah section opsi ke item soal
            }
            // Tampilkan jawaban benar untuk tipe lain jika perlu (Contoh: Benar/Salah)
            else if (q.question_type === 'benar_salah' && q.correct_answer) {
                 const answerDiv = document.createElement('div');
                 answerDiv.classList.add('correct-answer-display');
                 answerDiv.innerHTML = `<p><small>Jawaban: ${q.correct_answer}</small></p>`;
                 questionItem.appendChild(answerDiv);
            }

            // === Tombol Aksi (Edit, Hapus) ===
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
                     // Hapus dari tampilan
                     questionItem.remove();
                     // Hapus juga dari data array (agar konsisten)
                     const qId = questionItem.getAttribute('data-question-id');
                     displayedQuestionsData = displayedQuestionsData.filter((item, idx) => (item.id || `gen-${idx}`) !== qId);
                 }
            };
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            questionItem.appendChild(actionsDiv);

            questionsPreview.appendChild(questionItem); // Tambah item soal ke area preview
        });
    }

     // --- Fungsi untuk Mengaktifkan/Menonaktifkan Mode Edit Soal ---
    function toggleEditMode(questionItem) {
        const questionId = questionItem.getAttribute('data-question-id');
        // Ambil data soal asli dari array `displayedQuestionsData`
        const questionData = displayedQuestionsData.find((q, idx) => (q.id || `gen-${idx}`) === questionId);

        if (!questionData) {
            console.error("Data soal tidak ditemukan untuk ID:", questionId);
            alert("Gagal memulai edit: data soal tidak ditemukan.");
            return;
        }

        const textContainer = questionItem.querySelector('.question-text-container');
        const optionsDiv = questionItem.querySelector('.question-options');
        const editButton = questionItem.querySelector('.edit-actions button:not(.delete)');
        const isEditing = questionItem.classList.contains('is-editing'); // Cek class pada item utama

        if (isEditing) {
            // --- KELUAR DARI MODE EDIT (SIMPAN PERUBAHAN) ---
            const questionTextArea = textContainer.querySelector('textarea.edit-textarea');
            const newQuestionText = questionTextArea ? questionTextArea.value : questionData.question_text; // Ambil dari textarea jika ada

            // Update tampilan teks pertanyaan
            const questionNumberStrong = textContainer.querySelector('strong'); // Ambil nomor jika ada
            textContainer.innerHTML = `<p class="question-text">${questionNumberStrong ? questionNumberStrong.outerHTML : ''} ${newQuestionText}</p>`;

            // Update data pertanyaan di array
            questionData.question_text = newQuestionText;

            // Jika Pilihan Ganda, simpan juga opsi yang diedit
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionInputs = optionsDiv.querySelectorAll('input.edit-option-input');
                const optionsList = optionsDiv.querySelector('ul.options-list');
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];
                const newOptionsData = [];

                optionsList.innerHTML = ''; // Kosongkan list untuk diisi ulang

                optionInputs.forEach((input, index) => {
                     const newOptionText = input.value;
                     newOptionsData.push(newOptionText); // Simpan teks opsi baru ke array data

                     // Buat ulang tampilan list item (li)
                     const li = document.createElement('li');
                     const letter = optionLetters[index] || String.fromCharCode(97 + index);
                     li.innerHTML = `<span class="option-letter">${letter}.</span> <span class="option-text">${newOptionText}</span>`;
                     optionsList.appendChild(li);
                });

                // Update data opsi di array utama
                questionData.options = newOptionsData;

                // Tampilkan kembali info jawaban benar (yang mungkin perlu diperbarui jika opsi berubah)
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) answerDisplay.style.display = ''; // Tampilkan lagi

                 // (Opsional) Anda bisa menambahkan logika untuk mengizinkan edit jawaban benar di sini
            }

            editButton.textContent = 'Edit';
            questionItem.classList.remove('is-editing'); // Hapus penanda mode edit

            console.log("Data Soal Diperbarui (di memori):", questionData); // Log perubahan data

        } else {
            // --- MASUK KE MODE EDIT ---
            const questionNumberStrong = textContainer.querySelector('.question-text strong');
            const currentQuestionText = questionData.question_text; // Ambil teks dari data

            // Ubah teks pertanyaan menjadi textarea
            textContainer.innerHTML = `
                ${questionNumberStrong ? questionNumberStrong.outerHTML : ''}
                <textarea class="edit-textarea" style="width: 98%; min-height: 60px; margin-top: 5px;">${currentQuestionText}</textarea>
            `;

            // **IMPROVEMENT 2: Jika Pilihan Ganda, buat opsi jadi input**
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionsList = optionsDiv.querySelector('ul.options-list');
                const currentListItems = optionsList.querySelectorAll('li'); // Ambil li yang ada

                optionsList.innerHTML = ''; // Kosongkan list untuk diisi input

                // Ambil data opsi dari array questionData
                (questionData.options || []).forEach((optText, index) => {
                    const letter = ['a', 'b', 'c', 'd', 'e', 'f'][index] || String.fromCharCode(97 + index);

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = optText; // Isi dengan teks opsi dari data
                    input.classList.add('edit-option-input');
                    input.style.width = 'calc(95% - 25px)'; // Sesuaikan lebar
                    input.style.marginBottom = '5px';
                    input.style.padding = '5px';

                    const inputLi = document.createElement('li'); // Tetap pakai li agar struktur terjaga
                    inputLi.style.listStyle = 'none'; // Hilangkan bullet/number default
                    // Tambahkan label huruf di depan input
                    inputLi.innerHTML = `<span class="option-letter" style="margin-right: 5px;">${letter}.</span>`;
                    inputLi.appendChild(input);
                    optionsList.appendChild(inputLi);
                });

                 // Sembunyikan info jawaban benar selama edit
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) answerDisplay.style.display = 'none';
            }

            const textarea = textContainer.querySelector('textarea.edit-textarea');
            if(textarea) textarea.focus(); // Fokus ke textarea pertanyaan
            editButton.textContent = 'Simpan';
            questionItem.classList.add('is-editing'); // Tandai item sedang diedit
        }
    }

    // --- Fungsi Utilitas Error ---
    function showError(message) { /* ... (fungsi sama) ... */ }
    function hideError() { /* ... (fungsi sama) ... */ }

    // --- Event Listener Tombol Aksi (Placeholder) ---
    exportBtn.addEventListener('click', () => { /* ... (fungsi sama) ... */ });
    saveChangesBtn.addEventListener('click', () => { /* ... (fungsi sama) ... */ });

}); // Akhir DOMContentLoaded