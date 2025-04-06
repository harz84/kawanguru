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

    // === FUNGSI HELPER BARU untuk Membersihkan Prefix Opsi ===
    /**
     * Menghapus prefix list umum (seperti 'a.', '1)', ' B.') dari awal string.
     * @param {string} text Teks opsi asli.
     * @returns {string} Teks opsi yang sudah dibersihkan.
     */
    function cleanOptionText(text) {
        if (typeof text !== 'string') return text; // Kembalikan jika bukan string
        // Regex: ^\s* : Awal string diikuti 0 atau lebih spasi
        //        [a-zA-Z0-9]+ : Satu atau lebih huruf/angka (untuk a, b, 1, 2, dll.)
        //        [.)] : Diikuti oleh titik atau kurung tutup
        //        \s* : Diikuti oleh 0 atau lebih spasi
        const prefixRegex = /^\s*[a-zA-Z0-9]+[.)]\s*/;
        return text.replace(prefixRegex, ''); // Hapus prefix jika cocok
    }
    // ========================================================

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
                    // Simpan data soal untuk digunakan saat edit
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
        questionsPreview.innerHTML = '';

        if (!questions || questions.length === 0) {
            questionsPreview.innerHTML = '<p>Tidak ada soal untuk ditampilkan.</p>';
            return;
        }

        questions.forEach((q, index) => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            const uniqueId = q.id || `gen-${index}`;
            questionItem.setAttribute('data-question-id', uniqueId);

            // Kontainer Teks Pertanyaan
            const textContainer = document.createElement('div');
            textContainer.classList.add('question-text-container');
            textContainer.innerHTML = `<p class="question-text"><strong>${index + 1}.</strong> ${q.question_text || 'Teks soal tidak ditemukan.'}</p>`;
            questionItem.appendChild(textContainer);

            // Opsi Jawaban (jika Pilihan Ganda)
            if (q.question_type === 'pilihan_ganda' && q.options && Array.isArray(q.options) && q.options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('question-options');
                const optionsList = document.createElement('ul');
                optionsList.classList.add('options-list');
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];

                q.options.forEach((opt, optIndex) => {
                    const li = document.createElement('li');
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex);
                    // **PERBAIKAN: Gunakan cleanOptionText sebelum menampilkan teks opsi**
                    const cleanedOptText = cleanOptionText(opt);
                    li.innerHTML = `<span class="option-letter">${letter}.</span> <span class="option-text">${cleanedOptText}</span>`;
                    optionsList.appendChild(li);
                });
                optionsDiv.appendChild(optionsList);

                // Tampilkan Jawaban Benar di bawah opsi
                if (q.correct_answer) {
                    // Cari index jawaban benar berdasarkan TEKS OPSI YANG SUDAH DIBERSIHKAN
                    const cleanedCorrectAnswer = cleanOptionText(q.correct_answer);
                    const correctOptionIndex = q.options.findIndex(opt => cleanOptionText(opt) === cleanedCorrectAnswer);

                    if (correctOptionIndex !== -1) {
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        const answerDisplay = document.createElement('p');
                        answerDisplay.classList.add('correct-answer-display');
                        answerDisplay.innerHTML = `<i>Jawaban Benar: ${correctAnswerLetter}</i>`;
                        optionsDiv.appendChild(answerDisplay);
                    } else {
                         // Jika teks jawaban benar tidak cocok setelah dibersihkan
                         console.warn(`Jawaban benar "${q.correct_answer}" tidak ditemukan di opsi soal ${index + 1}.`);
                         const answerDisplay = document.createElement('p');
                         answerDisplay.classList.add('correct-answer-display', 'warning');
                         // Tampilkan teks asli dari AI untuk debug jika tidak cocok
                         answerDisplay.innerHTML = `<i>Jawaban Benar (Teks Asli AI): ${q.correct_answer}</i>`;
                         optionsDiv.appendChild(answerDisplay);
                    }
                }
                questionItem.appendChild(optionsDiv);
            }
            // Tampilkan jawaban tipe lain jika perlu
            else if (q.question_type === 'benar_salah' && q.correct_answer) {
                 const answerDiv = document.createElement('div');
                 answerDiv.classList.add('correct-answer-display');
                 answerDiv.innerHTML = `<p><small>Jawaban: ${q.correct_answer}</small></p>`;
                 questionItem.appendChild(answerDiv);
            }

            // Tombol Aksi
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
                     const qId = questionItem.getAttribute('data-question-id');
                     displayedQuestionsData = displayedQuestionsData.filter((item, idx) => (item.id || `gen-${idx}`) !== qId);
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
        const questionId = questionItem.getAttribute('data-question-id');
        const questionDataIndex = displayedQuestionsData.findIndex((q, idx) => (q.id || `gen-${idx}`) === questionId); // Dapatkan index

        if (questionDataIndex === -1) { // Cek jika index tidak ditemukan
            console.error("Data soal tidak ditemukan untuk ID:", questionId);
            alert("Gagal memulai edit: data soal tidak ditemukan.");
            return;
        }
        // Akses data menggunakan index agar bisa diupdate langsung di array
        const questionData = displayedQuestionsData[questionDataIndex];

        const textContainer = questionItem.querySelector('.question-text-container');
        const optionsDiv = questionItem.querySelector('.question-options');
        const editButton = questionItem.querySelector('.edit-actions button:not(.delete)');
        const isEditing = questionItem.classList.contains('is-editing');

        if (isEditing) {
            // --- KELUAR DARI MODE EDIT (SIMPAN PERUBAHAN) ---
            const questionTextArea = textContainer.querySelector('textarea.edit-textarea');
            const newQuestionText = questionTextArea ? questionTextArea.value : questionData.question_text;

            const questionNumberStrong = textContainer.querySelector('strong');
            textContainer.innerHTML = `<p class="question-text">${questionNumberStrong ? questionNumberStrong.outerHTML : ''} ${newQuestionText}</p>`;

            // Update data pertanyaan di array utama
            displayedQuestionsData[questionDataIndex].question_text = newQuestionText;

            // Jika Pilihan Ganda, simpan opsi yang diedit
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionInputs = optionsDiv.querySelectorAll('input.edit-option-input');
                const optionsList = optionsDiv.querySelector('ul.options-list');
                const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];
                const newOptionsData = [];

                optionsList.innerHTML = ''; // Kosongkan list

                optionInputs.forEach((input, index) => {
                     // Ambil teks dari input (sudah diedit pengguna)
                     const editedOptionText = input.value;
                     newOptionsData.push(editedOptionText); // Simpan teks baru

                     // Buat ulang tampilan list item (li)
                     const li = document.createElement('li');
                     const letter = optionLetters[index] || String.fromCharCode(97 + index);
                     // **PENTING**: Tetap gunakan teks yang BARU disimpan (editedOptionText) untuk tampilan
                     li.innerHTML = `<span class="option-letter">${letter}.</span> <span class="option-text">${editedOptionText}</span>`;
                     optionsList.appendChild(li);
                });

                // Update data opsi di array utama
                displayedQuestionsData[questionDataIndex].options = newOptionsData;

                // Tampilkan kembali info jawaban benar
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) {
                     // Update teks jawaban benar jika diperlukan (misal jika isinya diedit juga)
                     // Untuk sekarang, kita tampilkan lagi berdasarkan data yang mungkin sudah berubah
                     const cleanedCorrectAnswer = cleanOptionText(questionData.correct_answer); // Gunakan data asli/yg mungkin terupdate
                     const correctOptionIndex = newOptionsData.findIndex(opt => opt === cleanedCorrectAnswer); // Cari di opsi BARU

                     if (correctOptionIndex !== -1) {
                        const correctAnswerLetter = optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex);
                        answerDisplay.innerHTML = `<i>Jawaban Benar: ${correctAnswerLetter}</i>`;
                     } else {
                        answerDisplay.innerHTML = `<i>Jawaban Benar (Teks Asli AI): ${questionData.correct_answer}</i>`; // Fallback
                     }
                     answerDisplay.style.display = ''; // Tampilkan lagi
                 }
            }

            editButton.textContent = 'Edit';
            questionItem.classList.remove('is-editing');
            console.log("Data Soal Diperbarui (di memori):", displayedQuestionsData[questionDataIndex]);

        } else {
            // --- MASUK KE MODE EDIT ---
            const questionNumberStrong = textContainer.querySelector('.question-text strong');
            const currentQuestionText = questionData.question_text; // Ambil teks dari data

            textContainer.innerHTML = `
                ${questionNumberStrong ? questionNumberStrong.outerHTML : ''}
                <textarea class="edit-textarea" style="width: 98%; min-height: 60px; margin-top: 5px;">${currentQuestionText}</textarea>
            `;

            // Jika Pilihan Ganda, buat opsi jadi input
            if (questionData.question_type === 'pilihan_ganda' && optionsDiv) {
                const optionsList = optionsDiv.querySelector('ul.options-list');
                optionsList.innerHTML = ''; // Kosongkan list

                // Ambil data opsi dari array questionData
                (questionData.options || []).forEach((optText, index) => {
                    const letter = ['a', 'b', 'c', 'd', 'e', 'f'][index] || String.fromCharCode(97 + index);

                    const input = document.createElement('input');
                    input.type = 'text';
                    // **PERBAIKAN: Gunakan cleanOptionText saat mengisi value input**
                    input.value = cleanOptionText(optText); // Isi input dengan teks bersih
                    input.classList.add('edit-option-input');
                    input.style.width = 'calc(95% - 25px)';
                    input.style.marginBottom = '5px';
                    input.style.padding = '5px';

                    const inputLi = document.createElement('li');
                    inputLi.style.listStyle = 'none';
                    inputLi.innerHTML = `<span class="option-letter" style="margin-right: 5px;">${letter}.</span>`;
                    inputLi.appendChild(input);
                    optionsList.appendChild(inputLi);
                });

                 // Sembunyikan info jawaban benar selama edit
                 const answerDisplay = optionsDiv.querySelector('.correct-answer-display');
                 if (answerDisplay) answerDisplay.style.display = 'none';
            }

            const textarea = textContainer.querySelector('textarea.edit-textarea');
            if(textarea) textarea.focus();
            editButton.textContent = 'Simpan';
            questionItem.classList.add('is-editing');
        }
    }

    // --- Fungsi Utilitas Error ---
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

    // --- Event Listener Tombol Aksi (Export & Save Placeholder) ---
    exportBtn.addEventListener('click', () => {
        if (!displayedQuestionsData || displayedQuestionsData.length === 0) {
            alert('Tidak ada soal untuk diekspor.');
            return;
        }
        let txtContent = "Daftar Soal (Generated by Kawanguru)\n";
        txtContent += "=========================================\n\n";
        const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f'];

        displayedQuestionsData.forEach((question, index) => {
            txtContent += `${index + 1}. ${question.question_text}\n`; // Ambil dari data yang mungkin terupdate
            if (question.question_type === 'pilihan_ganda' && question.options && question.options.length > 0) {
                question.options.forEach((opt, optIndex) => {
                    const letter = optionLetters[optIndex] || String.fromCharCode(97 + optIndex);
                    // **PERBAIKAN: Pastikan ekspor juga pakai teks bersih**
                    txtContent += `   ${letter}. ${cleanOptionText(opt)}\n`;
                });
                 const cleanedCorrectAnswer = cleanOptionText(question.correct_answer);
                 const correctOptionIndex = question.options.findIndex(opt => cleanOptionText(opt) === cleanedCorrectAnswer);
                 let correctAnswerInfo = "Jawaban Benar: (Tidak ditentukan)";
                 if (correctOptionIndex !== -1) {
                     correctAnswerInfo = `Jawaban Benar: ${optionLetters[correctOptionIndex] || String.fromCharCode(97 + correctOptionIndex)}`;
                 } else if (question.correct_answer){
                     correctAnswerInfo = `Jawaban Benar (Teks Asli AI): ${question.correct_answer}`;
                 }
                txtContent += `   ${correctAnswerInfo}\n`;
            } else if (question.question_type === 'benar_salah' && question.correct_answer) {
                txtContent += `   Jawaban: ${question.correct_answer}\n`;
            }
            txtContent += "\n\n";
        });

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `kawanguru_soal_${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log("Soal berhasil diekspor ke file TXT.");
    });

    saveChangesBtn.addEventListener('click', () => {
        alert('Fungsi Simpan Perubahan (ke server/database) belum diimplementasikan.');
    });

}); // Akhir dari DOMContentLoaded