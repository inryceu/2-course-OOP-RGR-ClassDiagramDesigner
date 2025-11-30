import { RelationType } from '../models/ClassDiagram.js';
export function resolveOverlaps(positions, classNames, minGap, maxIterations = 10) {
    if (classNames.length <= 1)
        return;
    const sorted = classNames.map(name => ({
        name,
        pos: positions.get(name)
    })).sort((a, b) => a.pos.x - b.pos.x);
    let changed = true;
    let iterations = 0;
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i].pos;
            const next = sorted[i + 1].pos;
            const overlap = (current.x + current.width + minGap) - next.x;
            if (overlap > 0) {
                const shift = overlap / 2;
                current.x -= shift;
                next.x += shift;
                changed = true;
            }
        }
        for (let i = sorted.length - 1; i > 0; i--) {
            const current = sorted[i].pos;
            const prev = sorted[i - 1].pos;
            const overlap = (prev.x + prev.width + minGap) - current.x;
            if (overlap > 0) {
                const shift = overlap / 2;
                prev.x -= shift;
                current.x += shift;
                changed = true;
            }
        }
    }
}
export function calculateConnectionDensity(classNames, relationships) {
    if (classNames.length === 0)
        return 0;
    let totalConnections = 0;
    const nameSet = new Set(classNames);
    relationships.forEach(rel => {
        if (nameSet.has(rel.from) || nameSet.has(rel.to)) {
            totalConnections++;
        }
    });
    return totalConnections / classNames.length;
}
export function areClassesOnSameLevel(positions, classNames, threshold = 10) {
    if (classNames.length < 2)
        return false;
    const yPositions = classNames
        .map(name => positions.get(name))
        .filter(p => p !== undefined)
        .map(p => p.y);
    if (yPositions.length < 2)
        return false;
    const firstY = yPositions[0];
    return yPositions.every(y => Math.abs(y - firstY) < threshold);
}
export function centerElementsHorizontally(positions, classNames, targetWidth, offsetX = 0) {
    if (classNames.length === 0)
        return;
    const rects = classNames.map(name => positions.get(name));
    const minX = Math.min(...rects.map(r => r.x));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const actualWidth = maxX - minX;
    const centerOffset = (targetWidth - actualWidth) / 2 + offsetX - minX;
    if (Math.abs(centerOffset) > 5) {
        rects.forEach(rect => {
            rect.x += centerOffset;
        });
    }
}
export function minimizeCrossings(items, getCrossings, maxIterations = 5) {
    if (items.length <= 2)
        return items;
    let improved = true;
    let result = [...items];
    let iterations = 0;
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        for (let i = 0; i < result.length - 1; i++) {
            const currentCrossings = getCrossings(result, i, i + 1);
            [result[i], result[i + 1]] = [result[i + 1], result[i]];
            const newCrossings = getCrossings(result, i, i + 1);
            if (newCrossings < currentCrossings) {
                improved = true;
            }
            else {
                [result[i], result[i + 1]] = [result[i + 1], result[i]];
            }
        }
    }
    return result;
}
export function buildClassHierarchy(classes, relationships) {
    const hierarchy = [];
    const processed = new Set();
    const classMap = new Map();
    classes.forEach(cls => classMap.set(cls.name, cls));
    const dependents = new Map();
    const dependencies = new Map();
    const connectionCount = new Map();
    classes.forEach(cls => connectionCount.set(cls.name, 0));
    relationships.forEach(rel => {
        connectionCount.set(rel.from, (connectionCount.get(rel.from) || 0) + 1);
        connectionCount.set(rel.to, (connectionCount.get(rel.to) || 0) + 1);
        const requiresLevelSeparation = rel.type === RelationType.INHERITANCE ||
            rel.type === RelationType.IMPLEMENTATION ||
            rel.type === RelationType.COMPOSITION ||
            rel.type === RelationType.AGGREGATION;
        if (requiresLevelSeparation) {
            if (!dependents.has(rel.to)) {
                dependents.set(rel.to, new Set());
            }
            dependents.get(rel.to).add(rel.from);
            if (!dependencies.has(rel.from)) {
                dependencies.set(rel.from, new Set());
            }
            dependencies.get(rel.from).add(rel.to);
        }
    });
    const rootClasses = classes.filter(cls => (!dependencies.has(cls.name) || dependencies.get(cls.name).size === 0) &&
        (cls.isInterface || cls.isAbstract || (dependents.has(cls.name) && dependents.get(cls.name).size > 0)));
    if (rootClasses.length > 0) {
        hierarchy.push(rootClasses.sort((a, b) => (connectionCount.get(b.name) || 0) - (connectionCount.get(a.name) || 0)));
        rootClasses.forEach(cls => processed.add(cls.name));
    }
    let currentLevel = 0;
    while (processed.size < classes.length && currentLevel < 15) {
        const previousLevel = hierarchy[currentLevel];
        if (!previousLevel || previousLevel.length === 0)
            break;
        const nextLevel = [];
        previousLevel.forEach(parentClass => {
            const dependentNames = dependents.get(parentClass.name);
            if (dependentNames) {
                dependentNames.forEach(dependentName => {
                    if (!processed.has(dependentName)) {
                        const dependentClass = classMap.get(dependentName);
                        if (dependentClass) {
                            const classDeps = dependencies.get(dependentName);
                            let allDepsProcessed = true;
                            if (classDeps) {
                                classDeps.forEach(depName => {
                                    if (!processed.has(depName)) {
                                        allDepsProcessed = false;
                                    }
                                });
                            }
                            if (allDepsProcessed && !nextLevel.includes(dependentClass)) {
                                nextLevel.push(dependentClass);
                                processed.add(dependentName);
                            }
                        }
                    }
                });
            }
        });
        if (nextLevel.length > 0) {
            nextLevel.sort((a, b) => (connectionCount.get(b.name) || 0) - (connectionCount.get(a.name) || 0));
            hierarchy.push(nextLevel);
        }
        currentLevel++;
    }
    const remaining = classes.filter(cls => !processed.has(cls.name));
    if (remaining.length > 0) {
        distributeRemainingClasses(remaining, hierarchy, dependencies, connectionCount);
    }
    return hierarchy;
}
function distributeRemainingClasses(remaining, hierarchy, dependencies, connectionCount) {
    remaining.sort((a, b) => {
        if (a.isInterface !== b.isInterface)
            return a.isInterface ? -1 : 1;
        if (a.isAbstract !== b.isAbstract)
            return a.isAbstract ? -1 : 1;
        return (connectionCount.get(b.name) || 0) - (connectionCount.get(a.name) || 0);
    });
    const processed = new Set();
    hierarchy.forEach(level => level.forEach(cls => processed.add(cls.name)));
    const classToLevel = new Map();
    hierarchy.forEach((level, idx) => {
        level.forEach(cls => classToLevel.set(cls.name, idx));
    });
    const unplaced = [];
    for (const cls of remaining) {
        const deps = dependencies.get(cls.name);
        if (deps && deps.size > 0) {
            let maxDepLevel = -1;
            for (const dep of deps) {
                const depLevel = classToLevel.get(dep);
                if (depLevel !== undefined && depLevel > maxDepLevel) {
                    maxDepLevel = depLevel;
                }
            }
            if (maxDepLevel >= 0) {
                const targetLevel = maxDepLevel + 1;
                while (hierarchy.length <= targetLevel) {
                    hierarchy.push([]);
                }
                hierarchy[targetLevel].push(cls);
                classToLevel.set(cls.name, targetLevel);
                processed.add(cls.name);
            }
            else {
                unplaced.push(cls);
            }
        }
        else {
            unplaced.push(cls);
        }
    }
    const maxPerLevel = 7;
    for (let i = 0; i < unplaced.length; i += maxPerLevel) {
        const levelClasses = unplaced.slice(i, i + maxPerLevel);
        if (i === 0 && hierarchy.length > 0 && hierarchy[0].length < maxPerLevel) {
            const spaceAvailable = maxPerLevel - hierarchy[0].length;
            const toAdd = levelClasses.slice(0, spaceAvailable);
            const remainingClasses = levelClasses.slice(spaceAvailable);
            hierarchy[0] = [...hierarchy[0], ...toAdd];
            if (remainingClasses.length > 0) {
                hierarchy.push(remainingClasses);
            }
        }
        else {
            hierarchy.push(levelClasses);
        }
    }
}
//# sourceMappingURL=layoutUtils.js.map