package com.taskflow.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api")
public class TaskController {
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    private static final Set<String> PRIORITIES = Set.of("someday", "low", "medium", "high", "urgent");

    @GetMapping("/health")
    public Map<String, Object> health() { return Map.of("ok", true, "database", false, "mode", "java-demo"); }

    @GetMapping("/tasks")
    public List<Task> all() {
        List<Task> result = new ArrayList<>(tasks.values());
        result.sort((a, b) -> b.createdAt.compareTo(a.createdAt));
        return result;
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public Task create(@RequestBody Task task) {
        validate(task);
        task.id = UUID.randomUUID().toString();
        task.createdAt = Instant.now().toString();
        if (task.priority == null || task.priority.isBlank()) task.priority = "medium";
        tasks.put(task.id, task);
        return task;
    }

    @PutMapping("/tasks/{id}")
    public Task update(@PathVariable String id, @RequestBody Task changes) {
        Task old = tasks.get(id);
        if (old == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
        if (changes.title != null) old.title = changes.title.trim();
        if (changes.description != null) old.description = changes.description;
        if (changes.dueDate != null) old.dueDate = changes.dueDate;
        if (changes.priority != null) {
            if (!PRIORITIES.contains(changes.priority)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid priority");
            old.priority = changes.priority;
        }
        if (changes.category != null) old.category = changes.category;
        if (changes.completed != null) old.completed = changes.completed;
        validate(old);
        return old;
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        if (tasks.remove(id) == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
    }

    private void validate(Task task) {
        if (task.title == null || task.title.trim().isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required");
        task.title = task.title.trim();
        if (task.title.length() > 120) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title must be 120 characters or fewer");
        if (task.priority != null && !PRIORITIES.contains(task.priority)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid priority");
    }
}
