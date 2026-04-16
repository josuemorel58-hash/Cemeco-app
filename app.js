document.addEventListener('DOMContentLoaded', () => {
    const TOTAL_CABINS = 11;
    const gridContainer = document.getElementById('cabins-grid');
    const availableCountEl = document.getElementById('available-count');
    const occupiedCountEl = document.getElementById('occupied-count');
    
    // El StorageManager se encarga de cargar y guardar datos (LocalStorage o Supabase)
    let cabinsData = [];
    
    async function initData() {
        cabinsData = await StorageManager.loadData();
        
        // Migración: Si existe la cabina 10, cambiarla a 11
        cabinsData = cabinsData.map(c => {
            if (c.id === 10) return { ...c, id: 11 };
            return c;
        });

        if (cabinsData.length === 0) {
            for (let i = 1; i <= TOTAL_CABINS; i++) {
                if (i === 10) continue;
                cabinsData.push({
                    id: i,
                    status: 'available',
                    endTime: null
                });
            }
            await StorageManager.saveData(cabinsData);
        }
        renderCabins();
    }

    function updateStats() {
        const availableCount = cabinsData.filter(c => c.status === 'available').length;
        const occupiedCount = cabinsData.filter(c => c.status === 'occupied').length;
        const maintenanceCount = cabinsData.filter(c => c.status === 'maintenance').length;
        
        availableCountEl.textContent = availableCount;
        occupiedCountEl.textContent = occupiedCount;
        
        const maintenanceEl = document.getElementById('maintenance-count');
        if (maintenanceEl) maintenanceEl.textContent = maintenanceCount;
    }

    async function saveState() {
        await StorageManager.saveData(cabinsData);
        updateStats();
    }

    async function moveCabinToQueue(id, newStatus) {
        const cabinIndex = cabinsData.findIndex(c => c.id === id);
        if (cabinIndex === -1) return;

        const cabin = cabinsData.splice(cabinIndex, 1)[0];
        cabin.status = newStatus;

        if (newStatus === 'available') {
            cabin.endTime = null;
            const lastAvailableIndex = cabinsData.findLastIndex(c => c.status === 'available');
            if (lastAvailableIndex === -1) {
                cabinsData.unshift(cabin);
            } else {
                cabinsData.splice(lastAvailableIndex + 1, 0, cabin);
            }
        } else if (newStatus === 'occupied') {
            const lastOccupiedIndex = cabinsData.findLastIndex(c => c.status === 'occupied');
            if (lastOccupiedIndex === -1) {
                const lastAvailableIndex = cabinsData.findLastIndex(c => c.status === 'available');
                cabinsData.splice(lastAvailableIndex + 1, 0, cabin);
            } else {
                cabinsData.splice(lastOccupiedIndex + 1, 0, cabin);
            }
        } else {
            cabin.endTime = null;
            cabinsData.push(cabin);
        }

        await saveState();
        renderCabins();
    }

    async function toggleCabinStatus(id) {
        const cabin = cabinsData.find(c => c.id === id);
        if (!cabin) return;

        if (cabin.status === 'available') {
            await moveCabinToQueue(id, 'occupied');
        } else if (cabin.status === 'occupied') {
            await moveCabinToQueue(id, 'available');
        } else {
            await moveCabinToQueue(id, 'available');
        }
    }

    async function toggleMaintenance(id, event) {
        const cabin = cabinsData.find(c => c.id === id);
        if (!cabin) return;

        const nextStatus = cabin.status === 'maintenance' ? 'available' : 'maintenance';
        await moveCabinToQueue(id, nextStatus);
        
        if (event) event.stopPropagation();
    }

    function renderCabins() {
        gridContainer.innerHTML = '';
        if (!cabinsData) return;
        
        let firstAvailableFound = false;

        cabinsData.forEach((cabin, index) => {
            const card = document.createElement('div');
            card.className = 'cabin-card';
            card.dataset.status = cabin.status;
            card.dataset.id = cabin.id;
            card.style.animationDelay = `${index * 0.05}s`;
            
            if (cabin.status === 'available' && !firstAvailableFound) {
                card.classList.add('next-up');
                const nextBadge = document.createElement('div');
                nextBadge.className = 'next-badge';
                nextBadge.textContent = 'SIGUIENTE';
                card.appendChild(nextBadge);
                firstAvailableFound = true;
            }
            
            const numberEl = document.createElement('div');
            numberEl.className = 'cabin-number';
            numberEl.textContent = cabin.id.toString().padStart(2, '0');
            
            const statusEl = document.createElement('div');
            statusEl.className = 'cabin-status';
            
            let statusText = '';
            switch(cabin.status) {
                case 'available': statusText = 'Libre'; break;
                case 'occupied': statusText = 'Ocupada'; break;
                case 'maintenance': statusText = 'En Pausa'; break;
            }
            statusEl.textContent = statusText;
            
            const mtnBtn = document.createElement('button');
            mtnBtn.className = 'maintenance-btn';
            mtnBtn.title = cabin.status === 'maintenance' ? 'Habilitar Cabina' : 'Poner en Pausa';
            mtnBtn.innerHTML = cabin.status === 'maintenance' ? '⚡' : '⚙️';
            mtnBtn.onclick = async (e) => {
                await toggleMaintenance(cabin.id, e);
            };

            const linkBtn = document.createElement('button');
            linkBtn.className = 'view-link-btn';
            linkBtn.title = 'Abrir vista de cabina';
            linkBtn.innerHTML = '🔗';
            linkBtn.onclick = (e) => {
                window.open(`cabin.html?id=${cabin.id}`, '_blank');
                e.stopPropagation();
            };
            
            card.appendChild(mtnBtn);
            card.appendChild(linkBtn);
            card.appendChild(numberEl);
            card.appendChild(statusEl);
            
            card.addEventListener('click', async () => {
                card.style.transform = 'scale(0.95)';
                setTimeout(async () => {
                   await toggleCabinStatus(cabin.id); 
                }, 150);
            });
            
            gridContainer.appendChild(card);
        });
        
        updateStats();
    }

    // Sync con otras computadoras (Vía StorageManager: ya sea por evento 'storage' local o 'realtime' de Supabase)
    StorageManager.onSync((newData) => {
        cabinsData = newData;
        renderCabins();
    });

    initData();
});
